pub fn detect_installation(
    platform: &str,
    executable: Option<&str>,
    app_directory: Option<&str>,
    app_image_exists: bool,
) -> (bool, &'static str) {
    let Some(executable) = executable else {
        return (true, "unknown-installation");
    };
    if platform == "linux" {
        // APPIMAGE can be inherited by a system binary launched from another
        // AppImage. Only an executable inside this runtime's APPDIR may update it.
        let inside_appimage = app_directory.is_some_and(|directory| {
            let directory = directory.trim_end_matches('/');
            !directory.is_empty()
                && directory.starts_with('/')
                && executable.starts_with(&format!("{directory}/"))
        });
        return if app_image_exists && inside_appimage {
            (false, "appimage")
        } else {
            (true, "system-package")
        };
    }
    let executable = executable.replace('\\', "/").to_ascii_lowercase();
    let managed = match platform {
        "windows" => [
            "/scoop/apps/",
            "/chocolatey/lib/",
            "/microsoft/winget/packages/",
            "/windowsapps/",
        ]
        .iter()
        .any(|root| executable.contains(root)),
        "macos" => {
            executable.contains("/caskroom/")
                || executable.contains("/cellar/")
                || executable.starts_with("/opt/local/")
                || executable.starts_with("/nix/store/")
        }
        _ => true,
    };
    if managed {
        (true, "system-package")
    } else {
        (false, "standalone")
    }
}

#[cfg(test)]
mod tests {
    use super::detect_installation;

    #[test]
    fn linux_requires_the_actual_appimage_runtime_directory() {
        assert_eq!(
            detect_installation(
                "linux",
                Some("/tmp/.mount_MS/usr/bin/masterscript"),
                Some("/tmp/.mount_MS"),
                true
            ),
            (false, "appimage")
        );
        for (executable, directory, image_exists) in [
            ("/usr/bin/masterscript", Some("/tmp/.mount_MS"), true),
            (
                "/tmp/.mount_MS-other/usr/bin/masterscript",
                Some("/tmp/.mount_MS"),
                true,
            ),
            ("/usr/bin/masterscript", Some("/"), true),
            (
                "/tmp/.mount_MS/usr/bin/masterscript",
                Some("/tmp/.mount_MS"),
                false,
            ),
            ("/usr/bin/masterscript", None, false),
        ] {
            assert!(detect_installation("linux", Some(executable), directory, image_exists).0);
        }
    }

    #[test]
    fn known_windows_and_macos_manager_paths_remain_managed() {
        for (platform, executable) in [
            ("windows", r"C:\Users\Writer\scoop\apps\masterscript\current\masterscript.exe"),
            ("windows", r"C:\ProgramData\Chocolatey\lib\masterscript\tools\masterscript.exe"),
            ("windows", r"C:\Users\Writer\AppData\Local\Microsoft\WinGet\Packages\MasterScript\masterscript.exe"),
            ("windows", r"C:\Program Files\WindowsApps\MasterScript\masterscript.exe"),
            ("macos", "/opt/homebrew/Caskroom/masterscript/0.7.0/MasterScript.app/Contents/MacOS/masterscript"),
            ("macos", "/usr/local/Cellar/masterscript/0.7.0/bin/masterscript"),
            ("macos", "/opt/local/bin/masterscript"),
            ("macos", "/nix/store/package/Applications/MasterScript.app/Contents/MacOS/masterscript"),
        ] {
            assert!(detect_installation(platform, Some(executable), None, false).0, "{executable}");
        }
    }

    #[test]
    fn standalone_installs_update_but_unknown_paths_defer() {
        for (platform, executable) in [
            (
                "windows",
                r"C:\Users\Writer\AppData\Local\MasterScript\masterscript.exe",
            ),
            (
                "macos",
                "/Applications/MasterScript.app/Contents/MacOS/masterscript",
            ),
        ] {
            assert_eq!(
                detect_installation(platform, Some(executable), None, false),
                (false, "standalone")
            );
        }
        assert!(detect_installation("windows", None, None, false).0);
    }
}
