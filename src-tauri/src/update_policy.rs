use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicy {
    pub managed: bool,
    pub method: &'static str,
}

#[tauri::command]
pub fn installation_update_policy() -> UpdatePolicy {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("APPIMAGE").is_some() {
            return UpdatePolicy {
                managed: false,
                method: "appimage",
            };
        }
        // Only AppImage supports the Linux Tauri self-updater. System binaries,
        // including deb/rpm/pacman and unknown launchers, use their package path.
        UpdatePolicy {
            managed: true,
            method: "system-package",
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        UpdatePolicy {
            managed: false,
            method: "standalone",
        }
    }
}
