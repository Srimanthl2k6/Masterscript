mod domain;

use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use domain::Domain;
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Style},
    widgets::{Block, Borders, Paragraph, Wrap},
    Terminal,
};
use serde_json::{json, Value};
use std::{
    fs,
    io::{self, IsTerminal, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use unicode_width::UnicodeWidthChar;

struct TerminalGuard;
impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = execute!(io::stdout(), LeaveAlternateScreen);
    }
}

fn write_project(path: &Path, content: &str) -> Result<(), String> {
    if !path.to_string_lossy().ends_with(".msproj.json")
        && !path.to_string_lossy().ends_with(".msproj")
    {
        return Err("Use a .msproj.json or .msproj filename".into());
    }
    if path
        .symlink_metadata()
        .is_ok_and(|meta| meta.file_type().is_symlink())
    {
        return Err("Choose a regular project file, not a symbolic link".into());
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temporary
        .write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_project(path: &Path) -> Result<String, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 50 * 1024 * 1024 {
        return Err("Project exceeds 50 MiB import limit".into());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

const HELP: &str = "MASTERSCRIPT TERMINAL\n\nWrite directly in the current block. Enter splits at the caret. Tab changes block type.\nLeft/Right: caret · Home/End: block boundaries\nUp/Down: previous/next block · Alt+Up/Down: previous/next scene\nCtrl+Enter: insert action block · Ctrl+Delete: delete block\nCtrl+Z/Y: undo/redo · Ctrl+F: search\nCtrl+N: new · Ctrl+O: open · Ctrl+S: save · Ctrl+Shift+S: save as\nF2: title · F3: author · F4: choose report · F5: breakdown\nF6: add breakdown item · F7: edit item · F8: delete/reject item\nF9: add occurrence · F10: remove occurrence\nEsc: editor · Ctrl+Q: quit (dirty projects require confirmation)\n\nReports: scene, character, location, department, dialogue, summary.\nFor department reports: department|Props (or any department name).\nAdd item: Props|backpack. Edit: item ID|{\"notes\":\"Hero prop\",\"cost\":25}\nUse category/name/source in edit JSON to override or confirm an item.\nAdd occurrence: item ID|scene block ID. Remove: occurrence ID.\n\nAutosave writes a recovery copy every 30 seconds; your main file changes only on Save.\nOpening/new/quit with unsaved edits requires typing DISCARD.\nPress Esc to return.";

fn field<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().unwrap_or("")
}
fn safe_display(value: &str) -> String {
    value
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect()
}

// Hard-wrap the editable block so the drawn text and UTF-16 domain caret agree.
// The context pane uses word wrapping; the editing pane preserves every space.
fn editor_display(value: &str, caret: usize, width: usize) -> (String, usize, usize) {
    let width = width.max(1);
    let mut output = String::new();
    let (mut row, mut column, mut units) = (0, 0, 0);
    let mut cursor = (0, 0);
    for ch in value.chars() {
        let cells = if ch == '\t' {
            4
        } else {
            ch.width().unwrap_or(0)
        };
        if column > 0 && (column + cells > width || column == width) {
            output.push('\n');
            row += 1;
            column = 0;
        }
        if units <= caret {
            cursor = (row, column);
        }
        if ch == '\n' {
            output.push(ch);
            row += 1;
            column = 0;
        } else if ch == '\t' {
            output.push_str("    ");
            column += cells;
        } else if !ch.is_control() {
            output.push(ch);
            column += cells;
        }
        units += ch.len_utf16();
    }
    if caret >= units {
        if column >= width {
            output.push('\n');
            row += 1;
            column = 0;
        }
        cursor = (row, column);
    }
    (output, cursor.0, cursor.1.min(width - 1))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "--version") {
        println!("masterscript-tui {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if args.iter().any(|a| a == "--help" || a == "-h") {
        println!("masterscript-tui [project.msproj.json]\n\n{HELP}");
        return Ok(());
    }
    if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
        return Err("Run masterscript-tui in an interactive terminal".into());
    }
    let domain = Domain::new()?;
    let mut path = args.first().map(PathBuf::from);
    let mut state = if let Some(ref file) = path {
        domain.dispatch(json!({"op":"open", "value":read_project(file)?}))?
    } else {
        domain.dispatch(json!({"op":"state"}))?
    };
    enable_raw_mode()?;
    let _guard = TerminalGuard;
    execute!(io::stdout(), EnterAlternateScreen)?;
    let mut terminal = Terminal::new(CrosstermBackend::new(io::stdout()))?;
    let mut prompt: Option<(String, String)> = None;
    let mut pending = String::new();
    let mut status = String::new();
    let mut help = false;
    let mut scroll: u16 = 0;
    let mut last_save = Instant::now();
    loop {
        terminal.draw(|frame| {
            let rows = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),
                    Constraint::Min(4),
                    Constraint::Length(3),
                ])
                .split(frame.area());
            let dirty = if state["dirty"].as_bool().unwrap_or(false) {
                " *"
            } else {
                ""
            };
            frame.render_widget(
                Paragraph::new(safe_display(&format!(
                    "MasterScript  {}{} | {} | {}",
                    field(&state, "title"),
                    dirty,
                    field(&state, "view"),
                    path.as_ref()
                        .map(|p| p.display().to_string())
                        .unwrap_or_else(|| "Unsaved project".into())
                )))
                .style(Style::default().fg(Color::Cyan))
                .block(Block::default().borders(Borders::ALL)),
                rows[0],
            );
            if help {
                frame.render_widget(
                    Paragraph::new(HELP)
                        .wrap(Wrap { trim: false })
                        .scroll((scroll, 0))
                        .block(Block::default().title(" Help ").borders(Borders::ALL)),
                    rows[1],
                );
            } else if field(&state, "view") != "editor" {
                frame.render_widget(
                    Paragraph::new(safe_display(field(&state, "panel")))
                        .wrap(Wrap { trim: false })
                        .scroll((scroll, 0))
                        .block(
                            Block::default()
                                .title(" Report / Breakdown · PgUp/PgDn scroll · Esc editor ")
                                .borders(Borders::ALL),
                        ),
                    rows[1],
                );
            } else {
                let columns = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints([Constraint::Percentage(25), Constraint::Percentage(75)])
                    .split(rows[1]);
                let scenes = state["scenes"]
                    .as_array()
                    .map(|s| {
                        s.iter()
                            .filter_map(Value::as_str)
                            .collect::<Vec<_>>()
                            .join("\n\n")
                    })
                    .unwrap_or_default();
                frame.render_widget(
                    Paragraph::new(safe_display(&scenes))
                        .wrap(Wrap { trim: false })
                        .block(
                            Block::default()
                                .title(" Scenes · Alt+arrows ")
                                .borders(Borders::ALL),
                        ),
                    columns[0],
                );
                let editor_rows = Layout::default()
                    .direction(Direction::Vertical)
                    .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
                    .split(columns[1]);
                frame.render_widget(
                    Paragraph::new(safe_display(field(&state, "context")))
                        .wrap(Wrap { trim: false })
                        .block(
                            Block::default()
                                .title(" Screenplay context ")
                                .borders(Borders::ALL),
                        ),
                    editor_rows[0],
                );
                let caret = state["caret"].as_u64().unwrap_or(0) as usize;
                let width = editor_rows[1].width.saturating_sub(2).max(1) as usize;
                let (text, cursor_row, cursor_column) =
                    editor_display(field(&state, "text"), caret, width);
                let offset =
                    cursor_row.saturating_sub(editor_rows[1].height.saturating_sub(3) as usize);
                frame.render_widget(
                    Paragraph::new(text).scroll((offset as u16, 0)).block(
                        Block::default()
                            .title(format!(
                                " {} · block {}/{} · Tab type ",
                                field(&state, "type"),
                                state["index"].as_u64().unwrap_or(0) + 1,
                                state["blockCount"]
                            ))
                            .borders(Borders::ALL),
                    ),
                    editor_rows[1],
                );
                if prompt.is_none() && editor_rows[1].height > 2 {
                    frame.set_cursor_position((
                        editor_rows[1].x + 1 + cursor_column as u16,
                        editor_rows[1].y + 1 + (cursor_row - offset) as u16,
                    ));
                }
            }
            let footer = if let Some((kind, text)) = &prompt {
                format!("{kind}: {text} | Enter confirm · Esc cancel")
            } else if !status.is_empty() {
                status.clone()
            } else {
                format!(
                    "{} | Ctrl+S Save · Ctrl+Q Quit · F1 Help · F4 Reports · F5 Breakdown",
                    field(&state, "message")
                )
            };
            frame.render_widget(
                Paragraph::new(safe_display(&footer))
                    .wrap(Wrap { trim: false })
                    .block(Block::default().borders(Borders::ALL)),
                rows[2],
            );
        })?;
        if last_save.elapsed() >= Duration::from_secs(30) {
            if state["dirty"].as_bool().unwrap_or(false) {
                let recovery = path
                    .as_ref()
                    .map(|p| {
                        p.with_file_name(format!(
                            "{}.recovery.msproj.json",
                            p.file_stem().unwrap_or_default().to_string_lossy()
                        ))
                    })
                    .unwrap_or_else(|| {
                        std::env::temp_dir().join(format!(
                            "masterscript-tui-{}.recovery.msproj.json",
                            std::process::id()
                        ))
                    });
                status = match domain
                    .serialize()
                    .and_then(|json| write_project(&recovery, &json))
                {
                    Ok(()) => format!("Recovery saved: {}", recovery.display()),
                    Err(e) => format!("Autosave failed: {e}"),
                };
            }
            last_save = Instant::now();
        }
        if !event::poll(Duration::from_millis(200))? {
            continue;
        }
        let Event::Key(KeyEvent {
            code,
            modifiers,
            kind: KeyEventKind::Press | KeyEventKind::Repeat,
            ..
        }) = event::read()?
        else {
            continue;
        };
        if let Some((kind, text)) = prompt.as_mut() {
            match code {
                KeyCode::Esc => {
                    prompt = None;
                    pending.clear();
                }
                KeyCode::Backspace => {
                    text.pop();
                }
                KeyCode::Char(c) => text.push(c),
                KeyCode::Enter => {
                    let kind = kind.clone();
                    let value = text.clone();
                    prompt = None;
                    let result: Result<Option<Value>, String> = (|| {
                        if kind == "Type DISCARD to continue" {
                            if value != "DISCARD" {
                                return Ok(None);
                            }
                            if pending == "quit" {
                                return Ok(Some(json!({"quit":true})));
                            }
                            if pending == "new" {
                                path = None;
                                return domain.dispatch(json!({"op":"new"})).map(Some);
                            }
                            prompt = Some(("open".into(), String::new()));
                            return Ok(None);
                        }
                        match kind.as_str() {
                            "open" => {
                                let file = PathBuf::from(&value);
                                let next = domain
                                    .dispatch(json!({"op":"open","value":read_project(&file)?}))?;
                                path = Some(file);
                                Ok(Some(next))
                            }
                            "save as" => {
                                let file = PathBuf::from(&value);
                                if file.exists() && path.as_ref() != Some(&file) {
                                    pending = value;
                                    prompt = Some((
                                        "Type OVERWRITE to replace file".into(),
                                        String::new(),
                                    ));
                                    return Ok(None);
                                }
                                write_project(&file, &domain.serialize()?)?;
                                path = Some(file);
                                domain.dispatch(json!({"op":"saved"})).map(Some)
                            }
                            "Type OVERWRITE to replace file" => {
                                if value == "OVERWRITE" {
                                    let file = PathBuf::from(&pending);
                                    write_project(&file, &domain.serialize()?)?;
                                    path = Some(file);
                                    return domain.dispatch(json!({"op":"saved"})).map(Some);
                                }
                                Ok(None)
                            }
                            "add-item" | "report" => {
                                let (a, b) = value.split_once('|').unwrap_or((&value, "Props"));
                                let command = if kind == "report" {
                                    json!({"op":kind,"value":a,"category":b})
                                } else {
                                    json!({"op":kind,"category":a,"value":if b=="Props" { "" } else { b }})
                                };
                                domain.dispatch(command).map(Some)
                            }
                            "edit-item" | "add-occurrence" => {
                                let (id, data) = value.split_once('|').ok_or("Use ID|value")?;
                                domain
                                    .dispatch(json!({"op":kind,"id":id,"value":data}))
                                    .map(Some)
                            }
                            "remove-item" | "remove-occurrence" => {
                                domain.dispatch(json!({"op":kind,"id":value})).map(Some)
                            }
                            _ => domain.dispatch(json!({"op":kind,"value":value})).map(Some),
                        }
                    })();
                    match result {
                        Ok(Some(next)) if next["quit"] == true => break,
                        Ok(Some(next)) => {
                            state = next;
                            status.clear();
                        }
                        Ok(None) => {}
                        Err(e) => status = e,
                    }
                }
                _ => {}
            }
            continue;
        }
        let ctrl = modifiers.contains(KeyModifiers::CONTROL);
        let shift = modifiers.contains(KeyModifiers::SHIFT);
        if ctrl && matches!(code, KeyCode::Char('q' | 'n' | 'o')) {
            pending = match code {
                KeyCode::Char('q') => "quit",
                KeyCode::Char('n') => "new",
                _ => "open",
            }
            .into();
            if state["dirty"].as_bool().unwrap_or(false) {
                prompt = Some(("Type DISCARD to continue".into(), String::new()));
            } else if pending == "quit" {
                break;
            } else if pending == "new" {
                path = None;
                state = domain.dispatch(json!({"op":"new"}))?;
            } else {
                prompt = Some(("open".into(), String::new()));
            }
            continue;
        }
        if ctrl && matches!(code, KeyCode::Char('s' | 'S')) {
            if shift || path.is_none() {
                prompt = Some((
                    "save as".into(),
                    path.as_ref()
                        .map(|p| p.display().to_string())
                        .unwrap_or_default(),
                ));
            } else {
                match domain
                    .serialize()
                    .and_then(|json| write_project(path.as_ref().unwrap(), &json))
                {
                    Ok(()) => {
                        state = domain.dispatch(json!({"op":"saved"}))?;
                        status.clear();
                    }
                    Err(e) => status = e,
                }
            }
            continue;
        }
        if code == KeyCode::F(1) {
            help = !help;
            scroll = 0;
            continue;
        }
        let dialog = match code {
            KeyCode::F(2) => Some("title"),
            KeyCode::F(3) => Some("author"),
            KeyCode::F(4) => Some("report"),
            KeyCode::F(6) => Some("add-item"),
            KeyCode::F(7) => Some("edit-item"),
            KeyCode::F(8) => Some("remove-item"),
            KeyCode::F(9) => Some("add-occurrence"),
            KeyCode::F(10) => Some("remove-occurrence"),
            KeyCode::Char('f') if ctrl => Some("search"),
            _ => None,
        };
        if let Some(kind) = dialog {
            prompt = Some((kind.into(), String::new()));
            continue;
        }
        if matches!(code, KeyCode::PageUp | KeyCode::PageDown) {
            scroll = if code == KeyCode::PageDown {
                scroll.saturating_add(8)
            } else {
                scroll.saturating_sub(8)
            };
            continue;
        }
        let command = match code {
            KeyCode::Esc => {
                help = false;
                json!({"op":"editor"})
            }
            KeyCode::F(5) => {
                scroll = 0;
                json!({"op":"breakdown"})
            }
            _ if help || field(&state, "view") != "editor" => continue,
            KeyCode::Char('z') if ctrl => json!({"op":"undo"}),
            KeyCode::Char('y') if ctrl => json!({"op":"redo"}),
            KeyCode::Char(c) if !ctrl && !modifiers.contains(KeyModifiers::ALT) => {
                json!({"op":"insert","value":c.to_string()})
            }
            KeyCode::Enter => json!({"op":if ctrl { "insert-block" } else { "split" }}),
            KeyCode::Backspace => json!({"op":"backspace"}),
            KeyCode::Delete => json!({"op":if ctrl {"delete-block"} else {"delete-char"}}),
            KeyCode::Tab => json!({"op":"type"}),
            KeyCode::Home => json!({"op":"home"}),
            KeyCode::End => json!({"op":"end"}),
            KeyCode::Left | KeyCode::Right => {
                json!({"op":"move","amount":if code==KeyCode::Left {-1} else {1}})
            }
            KeyCode::Up | KeyCode::Down => {
                json!({"op":if modifiers.contains(KeyModifiers::ALT) {"scene"} else {"navigate"},"amount":if code==KeyCode::Up {-1} else {1}})
            }
            _ => continue,
        };
        match domain.dispatch(command) {
            Ok(next) => {
                state = next;
                status.clear();
            }
            Err(e) => status = e,
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resizing_and_unicode_keep_caret_aligned_with_text() {
        assert_eq!(editor_display("A界B", 2, 3), ("A界\nB".into(), 1, 0));
        assert_eq!(editor_display("A界B", 2, 8), ("A界B".into(), 0, 3));
        assert_eq!(editor_display("ab\ncd", 4, 8), ("ab\ncd".into(), 1, 1));
        assert_eq!(editor_display("abcd", 4, 4), ("abcd\n".into(), 1, 0));
    }
    #[test]
    fn atomic_save_reload_and_extension_guard() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.msproj.json");
        write_project(&path, "{\"blocks\":[]}").unwrap();
        assert_eq!(read_project(&path).unwrap(), "{\"blocks\":[]}");
        write_project(&path, "replacement").unwrap();
        assert_eq!(read_project(&path).unwrap(), "replacement");
        assert!(write_project(&dir.path().join("script.exe"), "bad").is_err());
    }
    #[test]
    fn terminal_control_sequences_are_not_rendered() {
        assert_eq!(safe_display("Hi\u{1b}[2J"), "Hi[2J");
    }
}
