use serde::Serialize;

#[path = "installation_method.rs"]
mod installation_method;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicy {
    pub managed: bool,
    pub method: &'static str,
}

#[tauri::command]
pub fn installation_update_policy() -> UpdatePolicy {
    let executable = std::env::current_exe()
        .ok()
        .and_then(|path| path.canonicalize().ok());
    let directory = std::env::var_os("APPDIR").and_then(|path| std::fs::canonicalize(path).ok());
    let image_exists = std::env::var_os("APPIMAGE").is_some_and(|path| {
        let path = std::path::Path::new(&path);
        path.is_absolute() && path.is_file()
    });
    let (managed, method) = installation_method::detect_installation(
        std::env::consts::OS,
        executable.as_deref().and_then(|path| path.to_str()),
        directory.as_deref().and_then(|path| path.to_str()),
        image_exists,
    );
    UpdatePolicy { managed, method }
}
