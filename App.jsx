import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { uiInfo, extractHiddenPrompt } from "./hidden";

/**
 * parseNumber - convierte una cadena a número de forma segura.
 */
function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).trim().replace(",", ".");
  if (s.length === 0) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * safeSqrt - raíz cuadrada con validación.
 */
function safeSqrt(v) {
  if (v < 0) throw new Error("Raíz cuadrada de número negativo.");
  return Math.sqrt(v);
}

/**
 * computeOperation - función pura para cálculos aritméticos.
 */
export function computeOperation(aStr, bStr, op) {
  const a = parseNumber(aStr);
  const b = parseNumber(bStr);

  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/": {
      const EPS = 1e-12;
      if (Math.abs(b) < EPS) throw new Error("División por cero o denominador cercano a cero.");
      return a / b;
    }
    case "^":
      return Math.pow(a, b);
    case "%":
      return a % b;
    case "sqrt":
      return safeSqrt(a);
    default:
      throw new Error("Operador desconocido");
  }
}

/**
 * sanitizeTemplate - valida y limita la plantilla de usuario.
 * Retorna cadena segura (vacía si no pasa validación).
 */
export function sanitizeTemplate(template) {
  if (template == null) return "";
  const t = String(template).replace(/[\r\n]+/g, " ").trim();
  const MAX = 500;
  const out = t.length > MAX ? t.slice(0, MAX) : t;
  // Permitir caracteres legibles y placeholders simples
  if (/^[\w\s\.,;:\-@#\{\}\(\)\/\?\!]+$/.test(out)) {
    return out;
  }
  return "";
}

/**
 * buildStructuredPrompt - devuelve un objeto estructurado en lugar de concatenar strings.
 */
export function buildStructuredPrompt({ systemMessage, userTemplate, userInput }) {
  return {
    system: String(systemMessage || "").slice(0, 300),
    template: sanitizeTemplate(userTemplate),
    input: String(userInput || "").replace(/[\r\n]+/g, " ").slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
}

/**
 * redactPromptForDisplay - versión segura para mostrar en UI.
 */
export function redactPromptForDisplay(structuredPrompt) {
  const tpl = structuredPrompt.template ? structuredPrompt.template : "[using internal template]";
  const input = structuredPrompt.input.length > 200 ? structuredPrompt.input.slice(0, 200) + "..." : structuredPrompt.input;
  return `System: ${structuredPrompt.system}\nTemplate: ${tpl}\nUser: ${input}`;
}

/**
 * SafeLLMPreview - muestra una versión redactada del prompt.
 */
function SafeLLMPreview({ prompt }) {
  return (
    <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#cfc", padding: 10 }}>
      {redactPromptForDisplay(prompt)}
    </pre>
  );
}
SafeLLMPreview.propTypes = {
  prompt: PropTypes.object.isRequired,
};

/**
 * App - componente principal (refactorizado).
 */
export default function App() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [op, setOp] = useState("+");
  const [res, setRes] = useState(null);
  const [userTpl, setUserTpl] = useState("");
  const [userInp, setUserInp] = useState("");
  const [showLLM, setShowLLM] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("badcalc_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const hidden = extractHiddenPrompt(uiInfo);

  useEffect(() => {
    try {
      localStorage.setItem("badcalc_history", JSON.stringify(history));
    } catch {
      // No interrumpir UX por fallos de persistencia
    }
  }, [history]);

  function handleCompute() {
    try {
      const value = computeOperation(a, b, op);
      setRes(value);
      const entry = { a: parseNumber(a), b: parseNumber(b), op, result: value, ts: new Date().toISOString() };
      setHistory((h) => [entry, ...h].slice(0, 200));
    } catch (err) {
      setRes(null);
      console.warn("Compute error:", err.message);
    }
  }

  function handleLLM() {
    const candidate = userTpl.trim() || (hidden ? String(hidden) : "");
    const safeTpl = sanitizeTemplate(candidate);
    const system = "You are an assistant that answers concisely.";
    const structured = buildStructuredPrompt({ systemMessage: system, userTemplate: safeTpl, userInput: userInp });
    setShowLLM(true);
    console.info("LLM structured prompt prepared (redacted):", redactPromptForDisplay(structured));
    // En producción: llamar SDK del proveedor del LLM con objeto 'structured'
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>BadCalc React — Refactored</h1>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder="a" aria-label="a" />
        <input value={b} onChange={(e) => setB(e.target.value)} placeholder="b" aria-label="b" />
        <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="op">
          <option value="+">+</option>
          <option value="-">-</option>
          <option value="*">*</option>
          <option value="/">/</option>
          <option value="^">^</option>
          <option value="%">%</option>
          <option value="sqrt">sqrt(a)</option>
        </select>
        <button onClick={handleCompute} type="button">=</button>
        <div style={{ minWidth: 180 }}>Resultado: {res === null ? "—" : String(res)}</div>
      </div>

      <hr />

      <h2>LLM (vista segura)</h2>
      <p style={{ maxWidth: 700 }}>
        Puede proporcionar una plantilla de usuario. Si la deja vacía, la aplicación puede usar una plantilla interna solo si pasa la validación.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 700 }}>
        <textarea value={userTpl} onChange={(e) => setUserTpl(e.target.value)} placeholder="user template (opcional)" />
        <input value={userInp} onChange={(e) => setUserInp(e.target.value)} placeholder="user input" />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleLLM} type="button">Preparar prompt seguro</button>
          <button onClick={() => { setUserTpl(""); setUserInp(""); }}>Limpiar</button>
        </div>
      </div>

      {showLLM && (
        <div style={{ marginTop: 10 }}>
          <SafeLLMPreview prompt={buildStructuredPrompt({ systemMessage: "You are an assistant.", userTemplate: sanitizeTemplate(userTpl || hidden || ""), userInput: userInp })} />
        </div>
      )}

      <hr />

      <h3>Historial</h3>
      <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #eee", padding: 8 }}>
        {history.length === 0 && <div>No hay operaciones.</div>}
        {history.map((h, idx) => (
          <div key={idx} style={{ fontFamily: "monospace", fontSize: 13, padding: "2px 0" }}>
            {`${h.a}|${h.b}|${h.op}|${h.result}`}
            <div style={{ fontSize: 11, color: "#666" }}>{new Date(h.ts).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
