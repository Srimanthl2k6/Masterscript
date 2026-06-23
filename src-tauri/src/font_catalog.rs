use crate::models::{FontFamilyDescriptor, FontLoadResult};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use fontdb::{Database, Style, Weight};
use std::collections::{BTreeMap, BTreeSet};

const MAX_FONT_BYTES: usize = 32 * 1024 * 1024;

fn style_label(style: Style, weight: Weight) -> &'static str {
    match (
        weight.0 >= 600,
        style == Style::Italic || style == Style::Oblique,
    ) {
        (true, true) => "bold-italic",
        (true, false) => "bold",
        (false, true) => "italic",
        (false, false) => "regular",
    }
}

fn load_database() -> Database {
    let mut database = Database::new();
    database.load_system_fonts();
    database
}

pub fn list_installed_fonts() -> Vec<FontFamilyDescriptor> {
    let database = load_database();
    let mut families: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for face in database.faces() {
        let Some((family, _)) = face.families.first() else {
            continue;
        };
        if family.trim().is_empty() || family.len() > 128 {
            continue;
        }
        families
            .entry(family.clone())
            .or_default()
            .insert(style_label(face.style, face.weight).to_string());
    }
    families
        .into_iter()
        .map(|(family, styles)| FontFamilyDescriptor {
            family,
            styles: styles.into_iter().collect(),
        })
        .collect()
}

pub fn load_font_for_export(family: &str, requested_style: &str) -> FontLoadResult {
    let family = family.trim();
    if family.is_empty() || family.len() > 128 {
        return FontLoadResult::failure("Invalid font family");
    }
    let requested_style = match requested_style {
        "regular" | "bold" | "italic" | "bold-italic" => requested_style,
        _ => return FontLoadResult::failure("Unsupported font style"),
    };
    let database = load_database();
    let face = database.faces().find(|face| {
        face.families
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case(family))
            && style_label(face.style, face.weight) == requested_style
    });
    let Some(face) = face else {
        return FontLoadResult::failure("Requested installed font face was not found");
    };
    let face_id = face.id;
    let result = database.with_face_data(face_id, |data, face_index| {
        if data.len() > MAX_FONT_BYTES {
            return Err("Font face exceeds the 32 MiB export limit".to_string());
        }
        let embeddable = ttf_parser::Face::parse(data, face_index)
            .map(|parsed| parsed.is_outline_embedding_allowed())
            .unwrap_or(false);
        Ok((STANDARD.encode(data), embeddable))
    });
    match result {
        Some(Ok((base64, embeddable))) => FontLoadResult::success(base64, embeddable),
        Some(Err(error)) => FontLoadResult::failure(error),
        None => FontLoadResult::failure("Installed font data could not be loaded"),
    }
}

#[cfg(test)]
mod tests {
    use super::style_label;
    use fontdb::{Style, Weight};

    #[test]
    fn maps_font_faces_to_public_style_names() {
        assert_eq!(style_label(Style::Normal, Weight::NORMAL), "regular");
        assert_eq!(style_label(Style::Italic, Weight::NORMAL), "italic");
        assert_eq!(style_label(Style::Normal, Weight::BOLD), "bold");
        assert_eq!(style_label(Style::Oblique, Weight::BOLD), "bold-italic");
    }
}
