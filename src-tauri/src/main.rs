#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, WebviewWindow};
use tauri::utils::config::Color;

#[derive(Debug, Serialize, Deserialize)]
struct StoredWindowPosition {
    x: i32,
    y: i32,
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

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                restore_position(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_current_window_position,
            restore_window_position,
            reset_window_position,
            nudge_window,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
