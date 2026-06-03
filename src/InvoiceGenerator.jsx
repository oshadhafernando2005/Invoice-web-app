import { useState, useRef, useCallback } from "react";

// ── constants ──────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: "LKR", sym: "Rs " },
  { code: "USD", sym: "$ " },
  { code: "EUR", sym: "€ " },
  { code: "GBP", sym: "£ " },
  { code: "JPY", sym: "¥ " },
  { code: "CAD", sym: "CA$ " },
  { code: "AUD", sym: "A$ " },
  { code: "INR", sym: "₹ " },
  { code: "SGD", sym: "S$ " },
  { code: "AED", sym: "د.إ " },
];

const UNITS = ["pcs", "kg", "g", "l", "ml", "m", "cm", "hrs", "days", "boxes", "cartons", "pkgs"];
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const YEARS  = ["24","25","26","27","28"];
const VAT_RATE = 18;

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(sym, n) {
  return sym + Math.max(0, n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toWords(n) {
  if (n === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function chunk(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " "+ones[num%10] : "") + " ";
    return ones[Math.floor(num/100)] + " Hundred " + chunk(num%100);
  }
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  let result = "";
  if (intPart >= 1000000) result += chunk(Math.floor(intPart/1000000)) + "Million ";
  if (intPart >= 1000)    result += chunk(Math.floor((intPart%1000000)/1000)) + "Thousand ";
  result += chunk(intPart % 1000);
  if (decPart > 0) result += "and " + chunk(decPart) + "Cents";
  return result.trim();
}

function today() { return new Date().toISOString().split("T")[0]; }
function uid()   { return Math.random().toString(36).slice(2,9); }

function validateTIN(tin) {
  if (!tin) return null;
  if (!/^\d{9}$/.test(tin)) return "TIN must be exactly 9 digits";
  return null;
}

// ── sub-components ─────────────────────────────────────────────────────────
function FieldGroup({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.07em",
        color: error ? "#dc2626" : "#475569", marginBottom: 3
      }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#dc2626", marginTop: 2, display: "block" }}>{error}</span>}
    </div>
  );
}

function TINInput({ value, onChange, placeholder }) {
  const err = validateTIN(value);
  return (
    <FieldGroup label="TIN (9 digits)" error={value ? err : null}>
      <input
        className="ig-field"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g,"").slice(0,9))}
        placeholder={placeholder || "123456789"}
        maxLength={9}
        inputMode="numeric"
      />
    </FieldGroup>
  );
}

function LineItemRow({ item, sym, onUpdate, onRemove }) {
  const amount = (parseFloat(item.qty)||0) * (parseFloat(item.rate)||0);
  return (
    <div className="ig-item-row">
      <input
        className="ig-item-field"
        placeholder="Describe item clearly…"
        value={item.desc}
        onChange={e => onUpdate(item.id,"desc",e.target.value)}
      />
      <input
        className="ig-item-field num"
        type="number" min="0" value={item.qty}
        onChange={e => onUpdate(item.id,"qty",e.target.value)}
      />
      <select
        className="ig-item-select"
        value={item.unit}
        onChange={e => onUpdate(item.id,"unit",e.target.value)}
      >
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <input
        className="ig-item-field num"
        type="number" min="0" step="0.01" value={item.rate}
        onChange={e => onUpdate(item.id,"rate",e.target.value)}
      />
      <span className="ig-item-amount">{fmt(sym, amount)}</span>
      <button className="ig-remove-btn" onClick={() => onRemove(item.id)} aria-label="Remove">✕</button>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function InvoiceGenerator() {
  const now = new Date();

  // currency
  const [currencyCode, setCurrencyCode] = useState("LKR");
  const [logoSrc, setLogoSrc]           = useState(null);

  // supplier
  const [supplierName,    setSupplierName]    = useState("");
  const [supplierTIN,     setSupplierTIN]     = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierEmail,   setSupplierEmail]   = useState("");
  const [supplierPhone,   setSupplierPhone]   = useState("");

  // purchaser
  const [purchaserName,    setPurchaserName]    = useState("");
  const [purchaserTIN,     setPurchaserTIN]     = useState("");
  const [purchaserAddress, setPurchaserAddress] = useState("");

  // invoice serial — split into fixed (YY + MMM) and manual (QQQQ + XXXXX)
  const [serialYY,    setSerialYY]    = useState(String(now.getFullYear()).slice(2));
  const [serialMMM,   setSerialMMM]   = useState(MONTHS[now.getMonth()]);
  const [serialQQQQ,  setSerialQQQQ]  = useState("");
  const [serialXXXXX, setSerialXXXXX] = useState("");

  // dates
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [supplyDate,  setSupplyDate]  = useState(today());

  // optional
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [paymentMode,   setPaymentMode]   = useState("");
  const [notes,         setNotes]         = useState("");

  // items
  const [items, setItems] = useState([
    { id: uid(), desc: "", qty: 1, unit: "pcs", rate: 0 },
    { id: uid(), desc: "", qty: 1, unit: "pcs", rate: 0 },
  ]);

  // vat & adjustments
  const [vatRate, setVatRate] = useState(VAT_RATE);
  const [discVal, setDiscVal] = useState(0);
  const [discType,setDiscType]= useState("pct");
  const [shipVal, setShipVal] = useState(0);

  const [serialNumberError, setSerialNumberError] = useState("");

  const fileRef = useRef();
  const sym = CURRENCIES.find(c => c.code === currencyCode)?.sym ?? "Rs ";

  // build full serial for display / validation
  const qPart = serialQQQQ.replace(/[^A-Z0-9]/g,"").slice(0,15);
  const xPart = serialXXXXX.replace(/\D/g,"").slice(0,10);
  const fullSerial = `${serialYY}${serialMMM}_${qPart}_${xPart}`;
  const serialTooLong = fullSerial.length > 40;
  const serialMissingParts = !qPart || !xPart;

  // calculations
  const subtotal      = items.reduce((s,i) => s + (parseFloat(i.qty)||0)*(parseFloat(i.rate)||0), 0);
  const discAmt       = discType==="pct" ? subtotal*(parseFloat(discVal)||0)/100 : parseFloat(discVal)||0;
  const valueExclVAT  = subtotal - discAmt + (parseFloat(shipVal)||0);
  const vatAmt        = valueExclVAT*(parseFloat(vatRate)||0)/100;
  const grandTotal    = valueExclVAT + vatAmt;

  // handlers
  const handleLogo = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const addItem    = () => setItems(prev => [...prev, { id:uid(), desc:"", qty:1, unit:"pcs", rate:0 }]);
  const removeItem = id => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = useCallback((id, field, val) => {
    setItems(prev => prev.map(i => i.id===id ? {...i,[field]:val} : i));
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#eef2f9;font-family:'DM Sans',sans-serif;color:#1e293b;}

        .ig-page{min-height:100vh;background:#eef2f9;display:flex;flex-direction:column;align-items:center;padding:28px 16px 64px;}
        .ig-card{width:100%;max-width:920px;border-radius:14px;box-shadow:0 6px 40px rgba(15,42,92,0.14);overflow:hidden;}

        /* toolbar */
        .ig-toolbar{background:#0f2a5c;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .ig-brand{font-family:'Playfair Display',serif;color:white;font-size:20px;}
        .ig-toolbar-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .ig-cur-select{background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.28);border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;outline:none;}
        .ig-cur-select option{background:#0f2a5c;}
        .ig-print-btn{background:white;color:#0f2a5c;border:none;border-radius:7px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s;}
        .ig-print-btn:hover{background:#dce8ff;}

        .ig-compliance-bar{background:#1a3d78;color:rgba(255,255,255,0.85);font-size:11.5px;text-align:center;padding:6px 16px;letter-spacing:0.03em;}

        /* paper */
        .ig-paper{background:white;padding:40px 44px 48px;}

        /* header */
        .ig-header-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;align-items:start;}
        .ig-logo-box{border:2px dashed #c2ccdf;border-radius:10px;min-height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;padding:12px;transition:border-color 0.2s;margin-bottom:12px;}
        .ig-logo-box:hover{border-color:#2563eb;}
        .ig-logo-box img{max-height:76px;max-width:100%;object-fit:contain;}
        .ig-logo-placeholder{color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;}

        .ig-title-block{text-align:right;}
        .ig-tax-invoice-badge{display:inline-block;background:#0f2a5c;color:white;font-size:20px;font-weight:700;letter-spacing:0.12em;padding:6px 18px;border-radius:6px;margin-bottom:16px;font-family:'DM Sans',sans-serif;}

        .ig-meta-grid{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;align-items:start;}
        .ig-meta-label{font-size:11.5px;color:#64748b;text-align:right;white-space:nowrap;font-weight:500;padding-top:6px;}
        .ig-meta-label.req::after{content:" *";color:#dc2626;}

        .ig-field{border:none;border-bottom:1px solid #c2ccdf;padding:4px 6px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:transparent;outline:none;width:100%;transition:border-color 0.15s;}
        .ig-field:focus{border-bottom-color:#2563eb;}
        .ig-field.right{text-align:right;}
        .ig-field.error{border-bottom-color:#dc2626;}

        /* serial builder */
        .ig-serial-builder{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
        .ig-serial-part-label{font-size:10px;color:#94a3b8;text-align:center;margin-bottom:2px;}
        .ig-serial-col{display:flex;flex-direction:column;}
        .ig-serial-select{border:1px solid #c2ccdf;border-radius:5px;padding:4px 5px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f4f7fc;outline:none;text-align:center;}
        .ig-serial-sep{font-size:14px;color:#94a3b8;font-weight:700;padding-top:18px;}
        .ig-serial-input{border:1px solid #c2ccdf;border-radius:5px;padding:4px 6px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f4f7fc;outline:none;text-align:center;}
        .ig-serial-input:focus{border-color:#2563eb;background:white;}
        .ig-serial-input-error{border-color:#dc2626 !important;background:#fff5f5 !important;}
        .ig-serial-preview{font-size:10.5px;color:#64748b;margin-top:5px;text-align:right;font-style:italic;}
        .ig-serial-error{font-size:10px;color:#dc2626;text-align:right;margin-top:2px;}

        /* section title */
        .ig-section-title{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#0f2a5c;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #0f2a5c;}

        /* parties */
        .ig-parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
        .ig-textarea{border:1px solid #c2ccdf;border-radius:7px;padding:8px 10px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;resize:none;transition:border-color 0.15s,background 0.15s;}
        .ig-textarea:focus{border-color:#2563eb;background:white;}

        /* items */
        .ig-items-header{display:grid;grid-template-columns:3fr 60px 76px 110px 100px 28px;gap:6px;padding:6px 0;border-bottom:2px solid #0f2a5c;margin-bottom:8px;}
        .ig-items-header span{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f2a5c;}
        .ig-items-header .num{text-align:right;}
        .ig-item-row{display:grid;grid-template-columns:3fr 60px 76px 110px 100px 28px;gap:6px;align-items:center;margin-bottom:5px;}
        .ig-item-field{border:none;border-bottom:1px solid transparent;padding:5px 4px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:transparent;outline:none;width:100%;transition:border-color 0.15s,background 0.15s;}
        .ig-item-field:focus{border-bottom-color:#2563eb;background:#eef2fb;border-radius:4px 4px 0 0;}
        .ig-item-field.num{text-align:right;}
        .ig-item-select{border:1px solid #c2ccdf;border-radius:5px;padding:4px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;}
        .ig-item-amount{font-size:13px;font-weight:500;color:#0f2a5c;text-align:right;padding:5px 4px;}
        .ig-remove-btn{background:none;border:none;color:#c2ccdf;cursor:pointer;font-size:13px;border-radius:4px;padding:3px 5px;transition:color 0.15s,background 0.15s;}
        .ig-remove-btn:hover{color:#dc2626;background:#fee2e2;}
        .ig-add-btn{margin-top:8px;background:#f4f7fc;border:1px dashed #c2ccdf;border-radius:7px;padding:7px 14px;font-size:13px;color:#1a3d78;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;display:flex;align-items:center;gap:6px;width:100%;transition:background 0.15s,border-color 0.15s;}
        .ig-add-btn:hover{background:#dce5f7;border-color:#2563eb;}

        /* bottom */
        .ig-bottom{display:grid;grid-template-columns:1fr 290px;gap:28px;margin-top:28px;}
        .ig-optional-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
        .ig-select-field{border:1px solid #c2ccdf;border-radius:6px;padding:6px 8px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;}
        .ig-totals-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;}
        .ig-total-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;}
        .ig-total-row:last-child{border-bottom:none;}
        .ig-total-row.emphasis{color:#0f2a5c;font-weight:600;}
        .ig-total-row.grand{font-size:16px;font-weight:700;color:#0f2a5c;border-top:2px solid #0f2a5c;border-bottom:none;padding-top:10px;margin-top:4px;}
        .ig-adj-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #e2e8f0;gap:6px;}
        .ig-adj-label{font-size:13px;color:#64748b;flex:1;}
        .ig-adj-input{width:56px;border:1px solid #c2ccdf;border-radius:5px;padding:3px 6px;font-size:12px;text-align:right;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:white;outline:none;}
        .ig-adj-input:focus{border-color:#2563eb;}
        .ig-adj-select{border:1px solid #c2ccdf;border-radius:5px;padding:3px 4px;font-size:11px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:white;outline:none;}
        .ig-adj-value{font-size:13px;color:#0f2a5c;min-width:72px;text-align:right;font-weight:500;}
        .ig-words-box{margin-top:16px;background:#f0f4fb;border-left:3px solid #0f2a5c;border-radius:0 6px 6px 0;padding:8px 12px;font-size:12px;color:#334155;line-height:1.5;}
        .ig-words-label{font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:2px;}
        .ig-compliance-footer{margin-top:28px;border-top:1px dashed #c2ccdf;padding-top:14px;font-size:10.5px;color:#94a3b8;text-align:center;line-height:1.6;}

        @media print {
          body{background:white;}
          .ig-toolbar,.ig-compliance-bar{display:none!important;}
          .ig-card{box-shadow:none;border-radius:0;}
          .ig-paper{padding:20px 28px 28px;}
          .ig-remove-btn,.ig-add-btn{display:none!important;}
          .ig-field,.ig-item-field,.ig-textarea,.ig-adj-input,.ig-adj-select,.ig-item-select,.ig-select-field,.ig-serial-select,.ig-serial-input{border-color:transparent!important;background:none!important;}
          .ig-logo-box{border:none;}
          .ig-totals-box{background:none;border:1px solid #ccc;}
          .ig-serial-sep{display:none;}
        }
      `}</style>

      <div className="ig-page">
        <div className="ig-card">

          {/* toolbar */}
          <div className="ig-toolbar">
            <span className="ig-brand">InvoiceForge</span>
            <div className="ig-toolbar-right">
              <select className="ig-cur-select" value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button className="ig-print-btn" onClick={() => window.print()}>🖨 Print / Save PDF</button>
            </div>
          </div>

          <div className="ig-compliance-bar">
            ✓ Compliant with IRD Circular SEC/2026/E/03 — Revised Tax Invoice Format (Effective July 1, 2026)
          </div>

          <div className="ig-paper">

            {/* === HEADER === */}
            <div className="ig-header-row">
              <div>
                <div className="ig-logo-box" onClick={() => fileRef.current.click()}>
                  {logoSrc
                    ? <img src={logoSrc} alt="Company logo" />
                    : <div className="ig-logo-placeholder">📷<br />Click to upload logo</div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogo} />
              </div>

              <div className="ig-title-block">
                <div><span className="ig-tax-invoice-badge">TAX INVOICE</span></div>

                <div className="ig-meta-grid" style={{ marginTop: 14 }}>

                  {/* ── Invoice Number builder ── */}
                  <span className="ig-meta-label req">Invoice No.</span>
                  <div>
                    <div className="ig-serial-builder">
                      {/* YY */}
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Year</div>
                        <select className="ig-serial-select" style={{ width: 52 }} value={serialYY} onChange={e => setSerialYY(e.target.value)}>
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      {/* MMM */}
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Month</div>
                        <select className="ig-serial-select" style={{ width: 60 }} value={serialMMM} onChange={e => setSerialMMM(e.target.value)}>
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <span className="ig-serial-sep">_</span>

                      {/* QQQQ */}
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Category</div>
                        <input
                          className="ig-serial-input"
                          style={{ width: 72 }}
                          placeholder="e.g. GEN"
                          value={serialQQQQ}
                          maxLength={15}
                          onChange={e => {
                            const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,15);
                            setSerialQQQQ(cleaned);
                          }}
                        />
                      </div>

                      <span className="ig-serial-sep">_</span>

                      {/* XXXXX */}
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Number</div>
                        <input
                          className={`ig-serial-input${serialNumberError ? " ig-serial-input-error" : ""}`}
                          style={{ width: 70 }}
                          placeholder="00001"
                          value={serialXXXXX}
                          maxLength={10}
                          inputMode="numeric"
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw && /[^0-9]/.test(raw)) {
                              setSerialNumberError("Numbers only");
                            } else {
                              setSerialNumberError("");
                            }
                            setSerialXXXXX(raw.replace(/\D/g,""));
                          }}
                        />
                        {serialNumberError && (
                          <span style={{ fontSize: 9, color: "#dc2626", marginTop: 2, textAlign: "center" }}>
                            {serialNumberError}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* preview */}
                    <div className="ig-serial-preview">
                      {fullSerial || "—"}
                    </div>
                    {serialTooLong && <div className="ig-serial-error">⚠ Exceeds 40 character limit</div>}
                    {serialMissingParts && <div className="ig-serial-error">Category and Number are required</div>}
                  </div>

                  <span className="ig-meta-label req">Invoice Date</span>
                  <input className="ig-field right" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />

                  <span className="ig-meta-label req">Date of Supply</span>
                  <input className="ig-field right" type="date" value={supplyDate} onChange={e => setSupplyDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* === PARTIES === */}
            <div className="ig-parties">
              <div>
                <div className="ig-section-title">Supplier Details</div>
                <FieldGroup label="Registered Business Name" required>
                  <input className="ig-field" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Your registered business name" />
                </FieldGroup>
                <TINInput value={supplierTIN} onChange={setSupplierTIN} placeholder="Supplier TIN (9 digits)" />
                <FieldGroup label="Registered Address" required>
                  <textarea className="ig-textarea" rows={2} value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} placeholder="As per VAT registration certificate" />
                </FieldGroup>
                <FieldGroup label="Email">
                  <input className="ig-field" type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="contact@example.com" />
                </FieldGroup>
                <FieldGroup label="Phone">
                  <input className="ig-field" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="+94 77 123 4567" />
                </FieldGroup>
              </div>
              <div>
                <div className="ig-section-title">Purchaser Details</div>
                <FieldGroup label="Purchaser Name / Company" required>
                  <input className="ig-field" value={purchaserName} onChange={e => setPurchaserName(e.target.value)} placeholder="Client name / company" />
                </FieldGroup>
                <TINInput value={purchaserTIN} onChange={setPurchaserTIN} placeholder="Purchaser TIN (if VAT registered)" />
                <FieldGroup label="Address" required>
                  <textarea className="ig-textarea" rows={2} value={purchaserAddress} onChange={e => setPurchaserAddress(e.target.value)} placeholder="As per VAT registration certificate" />
                </FieldGroup>
              </div>
            </div>

            {/* === LINE ITEMS === */}
            <div className="ig-section-title">Description of Supply</div>
            <div className="ig-items-header">
              <span>Description *</span>
              <span className="num">Qty *</span>
              <span>Unit *</span>
              <span className="num">Rate ({currencyCode})</span>
              <span className="num">Amount ({currencyCode})</span>
              <span />
            </div>
            {items.map(item => (
              <LineItemRow key={item.id} item={item} sym={sym} onUpdate={updateItem} onRemove={removeItem} />
            ))}
            <button className="ig-add-btn" onClick={addItem}>+ Add Line Item</button>

            {/* === BOTTOM === */}
            <div className="ig-bottom">
              <div>
                <div className="ig-section-title" style={{ marginBottom: 10 }}>Optional Information</div>
                <div className="ig-optional-grid">
                  <FieldGroup label="Mode of Payment">
                    <select className="ig-select-field" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                      <option value="">— Select —</option>
                      <option>Cash</option>
                      <option>Bank Transfer</option>
                      <option>Card</option>
                      <option>Cheque</option>
                      <option>Online</option>
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Place of Supply">
                    <input className="ig-field" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} placeholder="e.g. Colombo" />
                  </FieldGroup>
                </div>
                <FieldGroup label="Notes / References">
                  <textarea className="ig-textarea" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes, references, or payment instructions…" style={{ width:"100%" }} />
                </FieldGroup>
              </div>

              <div>
                <div className="ig-section-title" style={{ marginBottom: 10 }}>VAT Calculation</div>
                <div className="ig-totals-box">
                  <div className="ig-total-row">
                    <span>Subtotal</span>
                    <span>{fmt(sym, subtotal)}</span>
                  </div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label">Discount</span>
                    <input className="ig-adj-input" type="number" min="0" value={discVal} onChange={e => setDiscVal(e.target.value)} />
                    <select className="ig-adj-select" value={discType} onChange={e => setDiscType(e.target.value)}>
                      <option value="pct">%</option>
                      <option value="flat">flat</option>
                    </select>
                    <span className="ig-adj-value" style={{ color:"#dc2626" }}>−{fmt(sym, discAmt)}</span>
                  </div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label">Shipping</span>
                    <input className="ig-adj-input" type="number" min="0" value={shipVal} onChange={e => setShipVal(e.target.value)} />
                    <span style={{ width:42 }} />
                    <span className="ig-adj-value">{fmt(sym, parseFloat(shipVal)||0)}</span>
                  </div>
                  <div className="ig-total-row emphasis">
                    <span>Value of Supply (excl. VAT)</span>
                    <span>{fmt(sym, valueExclVAT)}</span>
                  </div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label" style={{ color:"#0f2a5c", fontWeight:600 }}>VAT Rate</span>
                    <input className="ig-adj-input" type="number" min="0" max="100" value={vatRate} onChange={e => setVatRate(e.target.value)} />
                    <span style={{ fontSize:11, color:"#64748b", width:42 }}>%</span>
                    <span className="ig-adj-value" style={{ color:"#1a3d78", fontWeight:600 }}>{fmt(sym, vatAmt)}</span>
                  </div>
                  <div className="ig-total-row grand">
                    <span>Total (incl. VAT)</span>
                    <span>{fmt(sym, grandTotal)}</span>
                  </div>
                </div>

                <div className="ig-words-box">
                  <div className="ig-words-label">Amount in Words</div>
                  {toWords(grandTotal)} {currencyCode}
                </div>
              </div>
            </div>

            <div className="ig-compliance-footer">
              Issued under the Value Added Tax Act No. 14 of 2002 &nbsp;|&nbsp;
              Circular SEC/2026/E/03 — Gazette Extraordinary No. 2481/22 dated March 27, 2026<br />
              This Tax Invoice must include only VAT-taxable supplies. Exempt supplies must not be included unless directly related to the taxable supply.
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
