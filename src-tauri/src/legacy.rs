use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallKind {
    Fresh,
    LegacyMigrated,
    ExistingTauri,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallState {
    pub kind: InstallKind,
    pub tutorial_completed: bool,
    pub migration_version: Option<u8>,
}

fn join(base: &str, suffix: &str, separator: char) -> String {
    format!(
        "{}{}{}",
        base.trim_end_matches(['/', '\\']),
        separator,
        suffix
    )
}

fn unique(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| !value.is_empty() && seen.insert(value.clone()))
        .collect()
}

pub fn candidates_for(
    platform: &str,
    home: Option<&str>,
    appdata: Option<&str>,
    local_appdata: Option<&str>,
    xdg_config_home: Option<&str>,
) -> Vec<String> {
    let home = home.unwrap_or_default();

    match platform {
        "windows" => {
            let roaming = appdata
                .map(str::to_owned)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| join(home, "AppData\\Roaming", '\\'));
            let local = local_appdata
                .map(str::to_owned)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| join(home, "AppData\\Local", '\\'));
            unique(vec![
                join(&roaming, "MasterScript", '\\'),
                join(&roaming, "masterscript", '\\'),
                join(&local, "MasterScript", '\\'),
                join(&local, "masterscript", '\\'),
            ])
        }
        "macos" => {
            let support = join(home, "Library/Application Support", '/');
            unique(vec![
                join(&support, "MasterScript", '/'),
                join(&support, "masterscript", '/'),
            ])
        }
        _ => {
            let config = xdg_config_home
                .map(str::to_owned)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| join(home, ".config", '/'));
            unique(vec![
                join(&config, "MasterScript", '/'),
                join(&config, "masterscript", '/'),
            ])
        }
    }
}

pub fn current_platform_candidates() -> Vec<String> {
    let platform = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok());

    candidates_for(
        platform,
        home.as_deref(),
        std::env::var("APPDATA").ok().as_deref(),
        std::env::var("LOCALAPPDATA").ok().as_deref(),
        std::env::var("XDG_CONFIG_HOME").ok().as_deref(),
    )
}

pub fn classify(
    legacy_evidence_exists: bool,
    tauri_settings_exist: bool,
    stored_tutorial_completed: Option<bool>,
) -> InstallState {
    if tauri_settings_exist {
        return InstallState {
            kind: InstallKind::ExistingTauri,
            tutorial_completed: stored_tutorial_completed.unwrap_or(false),
            migration_version: None,
        };
    }

    if legacy_evidence_exists {
        return InstallState {
            kind: InstallKind::LegacyMigrated,
            tutorial_completed: true,
            migration_version: Some(1),
        };
    }

    InstallState {
        kind: InstallKind::Fresh,
        tutorial_completed: false,
        migration_version: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{candidates_for, classify, InstallKind};

    #[test]
    fn covers_windows_electron_locations() {
        assert_eq!(
            candidates_for(
                "windows",
                Some(r"C:\Users\writer"),
                Some(r"C:\Users\writer\AppData\Roaming"),
                Some(r"C:\Users\writer\AppData\Local"),
                None,
            ),
            vec![
                r"C:\Users\writer\AppData\Roaming\MasterScript",
                r"C:\Users\writer\AppData\Roaming\masterscript",
                r"C:\Users\writer\AppData\Local\MasterScript",
                r"C:\Users\writer\AppData\Local\masterscript",
            ]
        );
    }

    #[test]
    fn covers_macos_and_linux_electron_locations() {
        assert_eq!(
            candidates_for("macos", Some("/Users/writer"), None, None, None),
            vec![
                "/Users/writer/Library/Application Support/MasterScript",
                "/Users/writer/Library/Application Support/masterscript",
            ]
        );
        assert_eq!(
            candidates_for(
                "linux",
                Some("/home/writer"),
                None,
                None,
                Some("/home/writer/.config"),
            ),
            vec![
                "/home/writer/.config/MasterScript",
                "/home/writer/.config/masterscript",
            ]
        );
    }

    #[test]
    fn legacy_evidence_always_suppresses_automatic_tutorial() {
        let state = classify(true, false, None);
        assert_eq!(state.kind, InstallKind::LegacyMigrated);
        assert!(state.tutorial_completed);
        assert_eq!(state.migration_version, Some(1));
    }

    #[test]
    fn fresh_and_existing_tauri_installations_remain_distinguishable() {
        assert_eq!(classify(false, false, None).kind, InstallKind::Fresh);
        let existing = classify(true, true, Some(true));
        assert_eq!(existing.kind, InstallKind::ExistingTauri);
        assert!(existing.tutorial_completed);
    }
}
