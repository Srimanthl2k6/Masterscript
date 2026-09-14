use rquickjs::{Context, Function, Runtime};
use serde_json::{json, Value};

pub struct Domain {
    context: Context,
    _runtime: Runtime,
}

impl Domain {
    pub fn new() -> Result<Self, String> {
        let runtime = Runtime::new().map_err(|e| e.to_string())?;
        runtime.set_memory_limit(256 * 1024 * 1024);
        let context = Context::full(&runtime).map_err(|e| e.to_string())?;
        context.with(|ctx| {
            ctx.eval::<(), _>(
                r#"globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
                globalThis.TextEncoder = class { encode(value) { const bytes = []; for (const c of value) { const n = c.codePointAt(0); for (let i = 0; i < (n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4); i++) bytes.push(0); } return { byteLength: bytes.length }; } };"#,
            ).map_err(|e| e.to_string())?;
            ctx.eval::<(), _>(include_str!("../generated/domain.js")).map_err(|e| e.to_string())?;
            ctx.eval::<(), _>("globalThis.session = MasterScriptDomain.createTerminalSession(); globalThis.dispatch = input => JSON.stringify(session.dispatch(JSON.parse(input)));")
                .map_err(|e| e.to_string())
        })?;
        Ok(Self {
            context,
            _runtime: runtime,
        })
    }

    pub fn dispatch(&self, command: Value) -> Result<Value, String> {
        self.context.with(|ctx| {
            let function: Function = ctx.globals().get("dispatch").map_err(|e| e.to_string())?;
            // Data crosses as a string argument. Screenplay contents are never executable code.
            let result: String = function.call((command.to_string(),)).map_err(|e| {
                let exception = ctx.catch();
                format!("{e}: {exception:?}")
            })?;
            serde_json::from_str(&result).map_err(|e| e.to_string())
        })
    }

    pub fn serialize(&self) -> Result<String, String> {
        Ok(self.dispatch(json!({"op":"serialize"}))?["json"]
            .as_str()
            .unwrap_or_default()
            .into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_domain_edits_and_round_trips_without_losing_fields() {
        let domain = Domain::new().unwrap();
        domain
            .dispatch(json!({"op":"insert", "value":"INT. HOSPITAL - NIGHT"}))
            .unwrap();
        domain.dispatch(json!({"op":"split"})).unwrap();
        domain
            .dispatch(json!({"op":"insert", "value":"RAVI lies unconscious beside a backpack."}))
            .unwrap();
        let report = domain
            .dispatch(json!({"op":"report", "value":"scene"}))
            .unwrap();
        assert!(report["panel"].as_str().unwrap().contains("RAVI"));
        assert!(report["panel"].as_str().unwrap().contains("backpack"));
        let saved = domain.serialize().unwrap();
        domain
            .dispatch(json!({"op":"open", "value":saved}))
            .unwrap();
        let reloaded: Value = serde_json::from_str(&domain.serialize().unwrap()).unwrap();
        assert_eq!(reloaded["blocks"].as_array().unwrap().len(), 2);
        assert!(reloaded["advanced"].is_object());
    }
}
