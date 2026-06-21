mod legacy;

use legacy::InstallState;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn legacy_data_candidates() -> Vec<String> {
    legacy::current_platform_candidates()
}

#[tauri::command]
fn classify_installation(app: tauri::AppHandle) -> InstallState {
    let legacy_exists = legacy::current_platform_candidates()
        .iter()
        .any(|candidate| Path::new(candidate).exists());
    let settings_path = app
        .path()
        .app_data_dir()
        .ok()
        .map(|directory| directory.join("install-state-v1.json"));
    let stored_tutorial_completed = settings_path
        .as_ref()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|value| value.get("tutorialCompleted")?.as_bool());
    let tauri_settings_exist = settings_path.as_ref().is_some_and(|path| path.is_file());

    legacy::classify(
        legacy_exists,
        tauri_settings_exist,
        stored_tutorial_completed,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            legacy_data_candidates,
            classify_installation
        ])
        .run(tauri::generate_context!())
        .expect("error while running MasterScript");
}
