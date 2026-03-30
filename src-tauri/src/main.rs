#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::utils::config::Color;
use tauri::{
    ActivationPolicy, AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

const TRAY_MENU_OPEN_SETTINGS: &str = "tray_open_settings";
const TRAY_MENU_RESET_POSITION: &str = "tray_reset_position";
const TRAY_MENU_FORCE_INTERACTIVE: &str = "tray_force_interactive";
const TRAY_MENU_QUIT: &str = "tray_quit";

#[derive(Debug, Serialize, Deserialize)]
struct StoredWindowPosition {
    x: i32,
    y: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InteractionStatePayload {
    click_through: bool,
}

#[derive(Default)]
struct InteractionState {
    click_through: Mutex<bool>,
}

fn position_store_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let mut base = app.path().app_config_dir().ok()?;
    base.push("window-position.json");
    Some(base)
}

fn save_position<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) {
    let Some(path) = position_store_path(app) else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let payload = StoredWindowPosition { x, y };
    if let Ok(json) = serde_json::to_string(&payload) {
        let _ = fs::write(path, json);
    }
}

fn restore_position<R: Runtime>(window: &WebviewWindow<R>) {
    let Some(path) = position_store_path(window.app_handle()) else {
        return;
    };

    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(saved) = serde_json::from_str::<StoredWindowPosition>(&content) {
            let _ = window.set_position(PhysicalPosition::new(saved.x, saved.y));
            return;
        }
    }

    let _ = reset_window_position_impl(window);
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_focus();
    }
}

fn emit_interaction_state<R: Runtime>(app: &AppHandle<R>, click_through: bool) {
    let _ = app.emit(
        "tsurubami://interaction-state-updated",
        InteractionStatePayload { click_through },
    );
}

fn set_click_through_impl<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> tauri::Result<()> {
    if let Some(state) = app.try_state::<InteractionState>() {
        if let Ok(mut click_through) = state.click_through.lock() {
            *click_through = enabled;
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        window.set_ignore_cursor_events(enabled)?;
        if !enabled {
            let _ = window.set_focus();
        }
    }

    emit_interaction_state(app, enabled);
    Ok(())
}

fn force_interactive_impl<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    set_click_through_impl(app, false)?;
    show_main_window(app);
    Ok(())
}

fn reset_window_position_impl<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()? {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let window_size = window.outer_size()?;

        let x = monitor_pos.x + (monitor_size.width as i32 - window_size.width as i32 - 36);
        let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32 - 56);

        window.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(())
}

fn clamp_window_to_monitor<R: Runtime>(
    window: &WebviewWindow<R>,
    target_x: i32,
    target_y: i32,
) -> tauri::Result<(i32, i32)> {
    if let Some(monitor) = window.current_monitor()? {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let window_size = window.outer_size()?;

        let min_x = monitor_pos.x;
        let min_y = monitor_pos.y;
        let max_x = monitor_pos.x + monitor_size.width as i32 - window_size.width as i32;
        let max_y = monitor_pos.y + monitor_size.height as i32 - window_size.height as i32;

        return Ok((target_x.clamp(min_x, max_x), target_y.clamp(min_y, max_y)));
    }

    Ok((target_x, target_y))
}

#[tauri::command]
fn save_current_window_position(app: AppHandle, window: WebviewWindow) {
    if let Ok(position) = window.outer_position() {
        save_position(&app, position.x, position.y);
    }
}

#[tauri::command]
fn restore_window_position(window: WebviewWindow) {
    restore_position(&window);
}

#[tauri::command]
fn reset_window_position(window: WebviewWindow, app: AppHandle) {
    if reset_window_position_impl(&window).is_ok() {
        if let Ok(position) = window.outer_position() {
            save_position(&app, position.x, position.y);
        }
    }
}

#[tauri::command]
fn nudge_window(window: WebviewWindow, app: AppHandle, dx: i32, dy: i32) -> tauri::Result<()> {
    let position = window.outer_position()?;
    let (x, y) = clamp_window_to_monitor(&window, position.x + dx, position.y + dy)?;
    window.set_position(PhysicalPosition::new(x, y))?;
    save_position(&app, x, y);
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_click_through_mode<R: Runtime>(app: AppHandle<R>, enabled: bool) -> tauri::Result<()> {
    set_click_through_impl(&app, enabled)
}

#[tauri::command]
fn force_interactive_mode<R: Runtime>(app: AppHandle<R>) -> tauri::Result<()> {
    force_interactive_impl(&app)
}

#[tauri::command]
fn get_interaction_state<R: Runtime>(app: AppHandle<R>) -> InteractionStatePayload {
    let click_through = app
        .try_state::<InteractionState>()
        .and_then(|state| state.click_through.lock().ok().map(|value| *value))
        .unwrap_or(false);

    InteractionStatePayload { click_through }
}

fn open_settings_window_impl<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let settings_window = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("settings.html".into()),
    )
    .title("tsurubami settings")
    .inner_size(420.0, 760.0)
    .resizable(false)
    .decorations(true)
    .always_on_top(true)
    .transparent(false)
    .build()?;

    let _ = settings_window.set_focus();
    Ok(())
}

#[tauri::command]
fn open_settings_window<R: Runtime>(app: AppHandle<R>) -> tauri::Result<()> {
    open_settings_window_impl(&app)
}

fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    let open_settings = MenuItem::with_id(app, TRAY_MENU_OPEN_SETTINGS, "打开设置", true, None::<&str>)?;
    let reset_position = MenuItem::with_id(app, TRAY_MENU_RESET_POSITION, "重置位置", true, None::<&str>)?;
    let force_interactive = MenuItem::with_id(
        app,
        TRAY_MENU_FORCE_INTERACTIVE,
        "恢复交互",
        true,
        Some("CmdOrCtrl+Shift+R"),
    )?;
    let quit = MenuItem::with_id(app, TRAY_MENU_QUIT, "退出", true, None::<&str>)?;

    menu.append(&open_settings)?;
    menu.append(&reset_position)?;
    menu.append(&force_interactive)?;
    menu.append(&quit)?;

    let mut tray_builder = TrayIconBuilder::with_id("tsurubami-tray")
        .menu(&menu)
        .tooltip("tsurubami")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_MENU_OPEN_SETTINGS => {
                let _ = open_settings_window_impl(app);
            }
            TRAY_MENU_RESET_POSITION => {
                if let Some(window) = app.get_webview_window("main") {
                    if reset_window_position_impl(&window).is_ok() {
                        if let Ok(position) = window.outer_position() {
                            save_position(app, position.x, position.y);
                        }
                    }
                    show_main_window(app);
                }
            }
            TRAY_MENU_FORCE_INTERACTIVE => {
                let _ = force_interactive_impl(app);
            }
            TRAY_MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon).icon_as_template(true);
    }

    let tray = tray_builder.build(app)?;
    app.manage(tray);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(InteractionState::default());

            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(ActivationPolicy::Accessory);
                app.set_dock_visibility(false);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                let _ = window.set_ignore_cursor_events(false);
                let _ = window.set_focus();
                restore_position(&window);
            }

            let _ = create_tray(app.handle());
            emit_interaction_state(app.handle(), false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_current_window_position,
            restore_window_position,
            reset_window_position,
            nudge_window,
            quit_app,
            open_settings_window,
            set_click_through_mode,
            force_interactive_mode,
            get_interaction_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
