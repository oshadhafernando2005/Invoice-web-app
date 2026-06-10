import { useState, useRef, useCallback, useEffect } from "react";

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

const UNITS  = ["pcs","kg","g","l","ml","m","cm","hrs","days","boxes","cartons","pkgs"];
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const YEARS  = ["24","25","26","27","28"];
const VAT_RATE = 18;

function fmt(sym, n) {
  return sym + Math.max(0,n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function toWords(n) {
  if (n===0) return "Zero";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function chunk(num){
    if(num===0)return"";
    if(num<20)return ones[num]+" ";
    if(num<100)return tens[Math.floor(num/10)]+(num%10?" "+ones[num%10]:"")+' ';
    return ones[Math.floor(num/100)]+" Hundred "+chunk(num%100);
  }
  const ip=Math.floor(n),dp=Math.round((n-ip)*100);
  let r="";
  if(ip>=1000000)r+=chunk(Math.floor(ip/1000000))+"Million ";
  if(ip>=1000)r+=chunk(Math.floor((ip%1000000)/1000))+"Thousand ";
  r+=chunk(ip%1000);
  if(dp>0)r+="and "+chunk(dp)+"Cents";
  return r.trim();
}
function today(){ return new Date().toISOString().split("T")[0]; }
function uid(){ return Math.random().toString(36).slice(2,9); }
function validateTIN(t){ if(!t)return null; return /^\d{9}$/.test(t)?null:"TIN must be 9 digits"; }
function fmtDate(d){ if(!d)return"—"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; }

function FieldGroup({label,required,error,children}){
  return(
    <div style={{marginBottom:8}}>
      <label style={{display:"block",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:error?"#dc2626":"#475569",marginBottom:3}}>
        {label}{required&&<span style={{color:"#dc2626",marginLeft:2}}>*</span>}
      </label>
      {children}
      {error&&<span style={{fontSize:11,color:"#dc2626",marginTop:2,display:"block"}}>{error}</span>}
    </div>
  );
}
function TINInput({value,onChange,placeholder}){
  const err=validateTIN(value);
  return(
    <FieldGroup label="TIN (9 digits)" error={value?err:null}>
      <input className="ig-field" value={value} onChange={e=>onChange(e.target.value.replace(/\D/g,"").slice(0,9))}
        placeholder={placeholder||"123456789"} maxLength={9} inputMode="numeric"/>
    </FieldGroup>
  );
}
function LineItemRow({item,sym,onUpdate,onRemove}){
  const amount=(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0);
  return(
    <div className="ig-item-row">
      <input className="ig-item-field" placeholder="Describe item clearly…" value={item.desc} onChange={e=>onUpdate(item.id,"desc",e.target.value)}/>
      <input className="ig-item-field num" type="number" min="0" value={item.qty} onChange={e=>onUpdate(item.id,"qty",e.target.value)}/>
      <select className="ig-item-select" value={item.unit} onChange={e=>onUpdate(item.id,"unit",e.target.value)}>
        {UNITS.map(u=><option key={u}>{u}</option>)}
      </select>
      <input className="ig-item-field num" type="number" min="0" step="0.01" value={item.rate} onChange={e=>onUpdate(item.id,"rate",e.target.value)}/>
      <span className="ig-item-amount">{fmt(sym,amount)}</span>
      <button className="ig-remove-btn" onClick={()=>onRemove(item.id)}>✕</button>
    </div>
  );
}

// ── PDF Preview Modal ──────────────────────────────────────────────────────
function PdfModal({onClose, data}){
  const {
    sym, currencyCode, logoSrc,
    supplierName, supplierTIN, supplierAddress, supplierEmail, supplierPhone,
    purchaserName, purchaserTIN, purchaserAddress,
    fullSerial, invoiceDate, supplyDate, dueDate,
    items, subtotal, discAmt, shipVal, valueExclVAT, vatRate, vatAmt, grandTotal,
    notes, paymentMode, placeOfSupply,
  } = data;

  const printAreaRef = useRef();

  const handleDownload = () => {
    const printWindow = window.open("","_blank","width=900,height=700");
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Tax Invoice ${fullSerial}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'DM Sans', sans-serif; color: #0f2a5c; font-size: 12px; background: white; }
  ${getInvoiceCSS()}
</style>
</head>
<body>
${printAreaRef.current.innerHTML}
<script>
  window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };
<\/script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"24px 16px",overflowY:"auto"}}>
      {/* modal toolbar */}
      <div style={{width:"100%",maxWidth:780,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{color:"white",fontWeight:600,fontSize:15,fontFamily:"DM Sans, sans-serif"}}>Invoice Preview</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleDownload} style={{background:"#2563eb",color:"white",border:"none",borderRadius:8,padding:"9px 22px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans, sans-serif",display:"flex",alignItems:"center",gap:7}}>
            ⬇ Download PDF
          </button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",color:"white",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"9px 18px",fontSize:14,cursor:"pointer",fontFamily:"DM Sans, sans-serif"}}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* A4 paper */}
      <div style={{width:"100%",maxWidth:780,background:"white",borderRadius:4,boxShadow:"0 8px 40px rgba(0,0,0,0.3)",padding:"36px 44px 44px",fontFamily:"DM Sans, sans-serif",color:"#0f2a5c"}}>
        <div ref={printAreaRef}>
          <style>{getInvoiceCSS()}</style>
          <InvoicePrintBody data={data}/>
        </div>
      </div>
    </div>
  );
}

function getInvoiceCSS(){
  return `
    .pi-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
    .pi-logo{max-height:70px;max-width:180px;object-fit:contain;}
    .pi-badge{display:inline-block;background:#0f2a5c;color:white;font-size:17px;font-weight:700;letter-spacing:0.12em;padding:5px 14px;border-radius:5px;margin-bottom:10px;font-family:DM Sans,sans-serif;}
    .pi-meta{font-size:11px;color:#334155;}
    .pi-meta-row{display:flex;justify-content:flex-end;gap:8px;margin-bottom:2px;}
    .pi-meta-label{color:#64748b;}
    .pi-meta-val{font-weight:600;min-width:130px;text-align:right;}
    .pi-divider{height:2px;background:#0f2a5c;margin:12px 0;}
    .pi-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;}
    .pi-party-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#0f2a5c;margin-bottom:4px;padding-bottom:2px;border-bottom:1.5px solid #0f2a5c;}
    .pi-party-name{font-size:12.5px;font-weight:600;color:#0f2a5c;margin-bottom:2px;}
    .pi-party-tin{font-size:11px;color:#475569;margin-bottom:2px;}
    .pi-party-addr{font-size:11px;color:#334155;white-space:pre-line;}
    .pi-party-contact{font-size:11px;color:#334155;margin-top:2px;}
    .pi-items-header{display:grid;grid-template-columns:3fr 50px 60px 95px 90px;gap:6px;padding:5px 0;border-bottom:1.5px solid #0f2a5c;margin-bottom:4px;}
    .pi-items-header span{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f2a5c;}
    .pi-items-header .r{text-align:right;}
    .pi-item-row{display:grid;grid-template-columns:3fr 50px 60px 95px 90px;gap:6px;padding:5px 0;border-bottom:1px solid #e2e8f0;align-items:center;}
    .pi-item-desc{font-size:12px;color:#0f2a5c;}
    .pi-item-num{font-size:12px;color:#0f2a5c;text-align:right;}
    .pi-item-unit{font-size:11px;color:#64748b;}
    .pi-bottom{display:grid;grid-template-columns:1fr 220px;gap:20px;margin-top:14px;}
    .pi-notes-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0f2a5c;margin-bottom:4px;}
    .pi-notes-text{font-size:11px;color:#334155;white-space:pre-line;line-height:1.5;}
    .pi-opt-row{font-size:11px;color:#475569;margin-bottom:3px;}
    .pi-opt-label{color:#94a3b8;}
    .pi-total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11.5px;color:#64748b;border-bottom:1px solid #e8edf7;}
    .pi-total-row.emph{color:#0f2a5c;font-weight:600;}
    .pi-total-row.grand{font-size:14px;font-weight:700;color:#0f2a5c;border-top:2px solid #0f2a5c;border-bottom:none;padding-top:7px;margin-top:3px;}
    .pi-words{margin-top:12px;background:#f0f4fb;border-left:3px solid #0f2a5c;padding:6px 10px;font-size:10.5px;color:#334155;border-radius:0 4px 4px 0;}
    .pi-words-label{font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:2px;}
    .pi-footer{margin-top:18px;border-top:1px dashed #c2ccdf;padding-top:10px;font-size:9.5px;color:#94a3b8;text-align:center;line-height:1.6;}
  `;
}

function InvoicePrintBody({data}){
  const {
    sym, currencyCode, logoSrc,
    supplierName, supplierTIN, supplierAddress, supplierEmail, supplierPhone,
    purchaserName, purchaserTIN, purchaserAddress,
    fullSerial, invoiceDate, supplyDate, dueDate,
    items, subtotal, discAmt, shipVal, valueExclVAT, vatRate, vatAmt, grandTotal,
    notes, paymentMode, placeOfSupply,
  } = data;

  return(
    <>
      {/* header */}
      <div className="pi-header">
        <div>{logoSrc?<img className="pi-logo" src={logoSrc} alt="logo"/>:<div style={{width:120}}/>}</div>
        <div style={{textAlign:"right"}}>
          <div><span className="pi-badge">TAX INVOICE</span></div>
          <div className="pi-meta">
            <div className="pi-meta-row"><span className="pi-meta-label">Invoice No.:</span><span className="pi-meta-val">{fullSerial||"—"}</span></div>
            <div className="pi-meta-row"><span className="pi-meta-label">Invoice Date:</span><span className="pi-meta-val">{fmtDate(invoiceDate)}</span></div>
            <div className="pi-meta-row"><span className="pi-meta-label">Date of Supply:</span><span className="pi-meta-val">{fmtDate(supplyDate)}</span></div>
            {dueDate&&<div className="pi-meta-row"><span className="pi-meta-label">Due Date:</span><span className="pi-meta-val">{fmtDate(dueDate)}</span></div>}
          </div>
        </div>
      </div>

      <div className="pi-divider"/>

      {/* parties */}
      <div className="pi-parties">
        <div>
          <div className="pi-party-label">Supplier</div>
          {supplierName&&<div className="pi-party-name">{supplierName}</div>}
          {supplierTIN&&<div className="pi-party-tin">TIN: {supplierTIN}</div>}
          {supplierAddress&&<div className="pi-party-addr">{supplierAddress}</div>}
          {supplierEmail&&<div className="pi-party-contact">✉ {supplierEmail}</div>}
          {supplierPhone&&<div className="pi-party-contact">📞 {supplierPhone}</div>}
        </div>
        <div>
          <div className="pi-party-label">Bill To</div>
          {purchaserName&&<div className="pi-party-name">{purchaserName}</div>}
          {purchaserTIN&&<div className="pi-party-tin">TIN: {purchaserTIN}</div>}
          {purchaserAddress&&<div className="pi-party-addr">{purchaserAddress}</div>}
        </div>
      </div>

      <div className="pi-divider"/>

      {/* items */}
      <div className="pi-items-header">
        <span>Description</span><span className="r">Qty</span>
        <span>Unit</span><span className="r">Rate ({currencyCode})</span>
        <span className="r">Amount ({currencyCode})</span>
      </div>
      {items.filter(i=>i.desc||(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0)>0).map(item=>{
        const amt=(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0);
        return(
          <div key={item.id} className="pi-item-row">
            <span className="pi-item-desc">{item.desc||"—"}</span>
            <span className="pi-item-num">{item.qty}</span>
            <span className="pi-item-unit">{item.unit}</span>
            <span className="pi-item-num">{fmt(sym,parseFloat(item.rate)||0)}</span>
            <span className="pi-item-num">{fmt(sym,amt)}</span>
          </div>
        );
      })}

      {/* bottom */}
      <div className="pi-bottom">
        <div>
          {notes&&<><div className="pi-notes-label">Notes</div><div className="pi-notes-text">{notes}</div></>}
          {(paymentMode||placeOfSupply)&&<div style={{marginTop:notes?8:0}}>
            {paymentMode&&<div className="pi-opt-row"><span className="pi-opt-label">Payment: </span>{paymentMode}</div>}
            {placeOfSupply&&<div className="pi-opt-row"><span className="pi-opt-label">Place of Supply: </span>{placeOfSupply}</div>}
          </div>}
        </div>
        <div>
          <div className="pi-total-row"><span>Subtotal</span><span>{fmt(sym,subtotal)}</span></div>
          {discAmt>0&&<div className="pi-total-row"><span>Discount</span><span style={{color:"#dc2626"}}>−{fmt(sym,discAmt)}</span></div>}
          {(parseFloat(shipVal)||0)>0&&<div className="pi-total-row"><span>Shipping</span><span>{fmt(sym,parseFloat(shipVal)||0)}</span></div>}
          <div className="pi-total-row emph"><span>Value excl. VAT</span><span>{fmt(sym,valueExclVAT)}</span></div>
          <div className="pi-total-row"><span>VAT ({vatRate}%)</span><span>{fmt(sym,vatAmt)}</span></div>
          <div className="pi-total-row grand"><span>Total (incl. VAT)</span><span>{fmt(sym,grandTotal)}</span></div>
        </div>
      </div>

      <div className="pi-words">
        <div className="pi-words-label">Amount in Words</div>
        {toWords(grandTotal)} {currencyCode}
      </div>

      <div className="pi-footer">
        Issued under the Value Added Tax Act No. 14 of 2002 &nbsp;|&nbsp; Circular SEC/2026/E/03 — Gazette Extraordinary No. 2481/22 dated March 27, 2026<br/>
        This Tax Invoice must include only VAT-taxable supplies. Exempt supplies must not be included unless directly related to the taxable supply.
      </div>
    </>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function InvoiceGenerator() {
  const now = new Date();

  const [currencyCode, setCurrencyCode] = useState("LKR");
  const [logoSrc, setLogoSrc]           = useState(null);

  const [supplierName,    setSupplierName]    = useState("");
  const [supplierTIN,     setSupplierTIN]     = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierEmail,   setSupplierEmail]   = useState("");
  const [supplierPhone,   setSupplierPhone]   = useState("");

  const [purchaserName,    setPurchaserName]    = useState("");
  const [purchaserTIN,     setPurchaserTIN]     = useState("");
  const [purchaserAddress, setPurchaserAddress] = useState("");

  const [serialYY,    setSerialYY]    = useState(String(now.getFullYear()).slice(2));
  const [serialMMM,   setSerialMMM]   = useState(MONTHS[now.getMonth()]);
  const [serialQQQQ,  setSerialQQQQ]  = useState("");
  const [serialXXXXX, setSerialXXXXX] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(today());
  const [supplyDate,  setSupplyDate]  = useState(today());
  const [dueDate,     setDueDate]     = useState("");

  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [paymentMode,   setPaymentMode]   = useState("");
  const [notes,         setNotes]         = useState("");

  const [items, setItems] = useState([
    { id:uid(), desc:"", qty:1, unit:"pcs", rate:0 },
    { id:uid(), desc:"", qty:1, unit:"pcs", rate:0 },
  ]);

  const [vatRate, setVatRate] = useState(VAT_RATE);
  const [discVal, setDiscVal] = useState(0);
  const [discType,setDiscType]= useState("pct");
  const [shipVal, setShipVal] = useState(0);

  const [showPreview, setShowPreview] = useState(false);

  const fileRef = useRef();
  const sym = CURRENCIES.find(c=>c.code===currencyCode)?.sym ?? "Rs ";

  const qPart = serialQQQQ.replace(/\s/g,"").slice(0,15);
  const xPart = serialXXXXX.replace(/\D/g,"").slice(0,10);
  const fullSerial = `${serialYY}${serialMMM}_${qPart}_${xPart}`;
  const serialTooLong = fullSerial.length>40;
  const serialMissing = !qPart||!xPart;

  const subtotal     = items.reduce((s,i)=>s+(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0),0);
  const discAmt      = discType==="pct"?subtotal*(parseFloat(discVal)||0)/100:parseFloat(discVal)||0;
  const valueExclVAT = subtotal-discAmt+(parseFloat(shipVal)||0);
  const vatAmt       = valueExclVAT*(parseFloat(vatRate)||0)/100;
  const grandTotal   = valueExclVAT+vatAmt;

  const handleLogo = e=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>setLogoSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const addItem    = ()=>setItems(p=>[...p,{id:uid(),desc:"",qty:1,unit:"pcs",rate:0}]);
  const removeItem = id=>setItems(p=>p.filter(i=>i.id!==id));
  const updateItem = useCallback((id,field,val)=>{
    setItems(p=>p.map(i=>i.id===id?{...i,[field]:val}:i));
  },[]);

  // lock body scroll when modal open
  useEffect(()=>{
    document.body.style.overflow = showPreview?"hidden":"";
    return()=>{document.body.style.overflow="";};
  },[showPreview]);

  const previewData = {
    sym, currencyCode, logoSrc,
    supplierName, supplierTIN, supplierAddress, supplierEmail, supplierPhone,
    purchaserName, purchaserTIN, purchaserAddress,
    fullSerial, invoiceDate, supplyDate, dueDate,
    items, subtotal, discAmt, shipVal, valueExclVAT, vatRate, vatAmt, grandTotal,
    notes, paymentMode, placeOfSupply,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#eef2f9;font-family:'DM Sans',sans-serif;color:#1e293b;}
        .ig-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:28px 16px 64px;}
        .ig-card{width:100%;max-width:920px;border-radius:14px;box-shadow:0 6px 40px rgba(15,42,92,0.14);overflow:hidden;}
        .ig-toolbar{background:#0f2a5c;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .ig-brand{font-family:'Playfair Display',serif;color:white;font-size:20px;}
        .ig-toolbar-right{display:flex;gap:10px;align-items:center;}
        .ig-cur-select{background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.28);border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;outline:none;}
        .ig-cur-select option{background:#0f2a5c;}
        .ig-preview-btn{background:white;color:#0f2a5c;border:none;border-radius:7px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s;display:flex;align-items:center;gap:6px;}
        .ig-preview-btn:hover{background:#dce8ff;}
        .ig-compliance-bar{background:#1a3d78;color:rgba(255,255,255,0.85);font-size:11px;text-align:center;padding:6px 16px;}
        .ig-paper{background:white;padding:36px 44px 44px;}
        .ig-header-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;align-items:start;}
        .ig-logo-box{border:2px dashed #c2ccdf;border-radius:10px;min-height:86px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;padding:12px;transition:border-color 0.2s;margin-bottom:10px;}
        .ig-logo-box:hover{border-color:#2563eb;}
        .ig-logo-box img{max-height:72px;max-width:100%;object-fit:contain;}
        .ig-logo-placeholder{color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;}
        .ig-title-block{text-align:right;}
        .ig-tax-invoice-badge{display:inline-block;background:#0f2a5c;color:white;font-size:19px;font-weight:700;letter-spacing:0.12em;padding:5px 16px;border-radius:6px;margin-bottom:14px;}
        .ig-meta-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start;}
        .ig-meta-label{font-size:11px;color:#64748b;text-align:right;white-space:nowrap;font-weight:500;padding-top:5px;}
        .ig-meta-label.req::after{content:" *";color:#dc2626;}
        .ig-field{border:none;border-bottom:1px solid #c2ccdf;padding:4px 6px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:transparent;outline:none;width:100%;transition:border-color 0.15s;}
        .ig-field:focus{border-bottom-color:#2563eb;}
        .ig-field.right{text-align:right;}
        .ig-serial-builder{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end;}
        .ig-serial-part-label{font-size:10px;color:#94a3b8;text-align:center;margin-bottom:2px;}
        .ig-serial-col{display:flex;flex-direction:column;}
        .ig-serial-select{border:1px solid #c2ccdf;border-radius:5px;padding:4px 5px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f4f7fc;outline:none;}
        .ig-serial-sep{font-size:14px;color:#94a3b8;font-weight:700;padding-top:18px;}
        .ig-serial-input{border:1px solid #c2ccdf;border-radius:5px;padding:4px 6px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f4f7fc;outline:none;text-align:center;}
        .ig-serial-input:focus{border-color:#2563eb;background:white;}
        .ig-serial-preview{font-size:10px;color:#64748b;margin-top:4px;text-align:right;font-style:italic;}
        .ig-serial-error{font-size:10px;color:#dc2626;text-align:right;margin-top:2px;}
        .ig-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#0f2a5c;margin-bottom:8px;padding-bottom:3px;border-bottom:2px solid #0f2a5c;}
        .ig-parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:22px;}
        .ig-textarea{border:1px solid #c2ccdf;border-radius:7px;padding:7px 10px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;resize:none;transition:border-color 0.15s,background 0.15s;}
        .ig-textarea:focus{border-color:#2563eb;background:white;}
        .ig-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .ig-items-header{display:grid;grid-template-columns:3fr 60px 76px 110px 100px 28px;gap:6px;padding:5px 0;border-bottom:2px solid #0f2a5c;margin-bottom:6px;}
        .ig-items-header span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f2a5c;}
        .ig-items-header .num{text-align:right;}
        .ig-item-row{display:grid;grid-template-columns:3fr 60px 76px 110px 100px 28px;gap:6px;align-items:center;margin-bottom:4px;}
        .ig-item-field{border:none;border-bottom:1px solid transparent;padding:5px 4px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:transparent;outline:none;width:100%;transition:border-color 0.15s,background 0.15s;}
        .ig-item-field:focus{border-bottom-color:#2563eb;background:#eef2fb;border-radius:4px 4px 0 0;}
        .ig-item-field.num{text-align:right;}
        .ig-item-select{border:1px solid #c2ccdf;border-radius:5px;padding:4px;font-size:12px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;}
        .ig-item-amount{font-size:13px;font-weight:500;color:#0f2a5c;text-align:right;padding:5px 4px;}
        .ig-remove-btn{background:none;border:none;color:#c2ccdf;cursor:pointer;font-size:13px;border-radius:4px;padding:3px 5px;transition:color 0.15s,background 0.15s;}
        .ig-remove-btn:hover{color:#dc2626;background:#fee2e2;}
        .ig-add-btn{margin-top:6px;background:#f4f7fc;border:1px dashed #c2ccdf;border-radius:7px;padding:6px 14px;font-size:13px;color:#1a3d78;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;display:flex;align-items:center;gap:6px;width:100%;transition:background 0.15s,border-color 0.15s;}
        .ig-add-btn:hover{background:#dce5f7;border-color:#2563eb;}
        .ig-bottom{display:grid;grid-template-columns:1fr 280px;gap:24px;margin-top:22px;}
        .ig-optional-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
        .ig-select-field{border:1px solid #c2ccdf;border-radius:6px;padding:6px 8px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:#f8fafc;outline:none;width:100%;}
        .ig-totals-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;}
        .ig-total-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;}
        .ig-total-row:last-child{border-bottom:none;}
        .ig-total-row.emphasis{color:#0f2a5c;font-weight:600;}
        .ig-total-row.grand{font-size:15px;font-weight:700;color:#0f2a5c;border-top:2px solid #0f2a5c;border-bottom:none;padding-top:8px;margin-top:3px;}
        .ig-adj-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #e2e8f0;gap:6px;}
        .ig-adj-label{font-size:13px;color:#64748b;flex:1;}
        .ig-adj-input{width:52px;border:1px solid #c2ccdf;border-radius:5px;padding:3px 6px;font-size:12px;text-align:right;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:white;outline:none;}
        .ig-adj-input:focus{border-color:#2563eb;}
        .ig-adj-select{border:1px solid #c2ccdf;border-radius:5px;padding:3px 4px;font-size:11px;font-family:'DM Sans',sans-serif;color:#0f2a5c;background:white;outline:none;}
        .ig-adj-value{font-size:13px;color:#0f2a5c;min-width:72px;text-align:right;font-weight:500;}
        .ig-words-box{margin-top:12px;background:#f0f4fb;border-left:3px solid #0f2a5c;border-radius:0 6px 6px 0;padding:7px 11px;font-size:11.5px;color:#334155;line-height:1.5;}
        .ig-words-label{font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:2px;}
        .ig-compliance-footer{margin-top:22px;border-top:1px dashed #c2ccdf;padding-top:12px;font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;}
        @media print{body,html{display:none!important;}}
      `}</style>

      <div className="ig-page">
        <div className="ig-card">
          <div className="ig-toolbar">
            <span className="ig-brand">InvoiceForge</span>
            <div className="ig-toolbar-right">
              <select className="ig-cur-select" value={currencyCode} onChange={e=>setCurrencyCode(e.target.value)}>
                {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button className="ig-preview-btn" onClick={()=>setShowPreview(true)}>
                👁 Preview &amp; Save PDF
              </button>
            </div>
          </div>

          <div className="ig-compliance-bar">
            ✓ Compliant with IRD Circular SEC/2026/E/03 — Revised Tax Invoice Format (Effective July 1, 2026)
          </div>

          <div className="ig-paper">
            {/* header */}
            <div className="ig-header-row">
              <div>
                <div className="ig-logo-box" onClick={()=>fileRef.current.click()}>
                  {logoSrc?<img src={logoSrc} alt="logo"/>:<div className="ig-logo-placeholder">📷<br/>Click to upload logo</div>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/>
              </div>
              <div className="ig-title-block">
                <span className="ig-tax-invoice-badge">TAX INVOICE</span>
                <div className="ig-meta-grid" style={{marginTop:12}}>
                  <span className="ig-meta-label req">Invoice No.</span>
                  <div>
                    <div className="ig-serial-builder">
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Year</div>
                        <select className="ig-serial-select" style={{width:50}} value={serialYY} onChange={e=>setSerialYY(e.target.value)}>
                          {YEARS.map(y=><option key={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Month</div>
                        <select className="ig-serial-select" style={{width:58}} value={serialMMM} onChange={e=>setSerialMMM(e.target.value)}>
                          {MONTHS.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <span className="ig-serial-sep">_</span>
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Category</div>
                        <input className="ig-serial-input" style={{width:70}} placeholder="GEN" value={serialQQQQ} maxLength={15}
                          onChange={e=>setSerialQQQQ(e.target.value.replace(/\s/g,"").toUpperCase())}/>
                      </div>
                      <span className="ig-serial-sep">_</span>
                      <div className="ig-serial-col">
                        <div className="ig-serial-part-label">Number</div>
                        <input className="ig-serial-input" style={{width:68}} placeholder="00001" value={serialXXXXX} maxLength={10} inputMode="numeric"
                          onChange={e=>setSerialXXXXX(e.target.value.replace(/\D/g,""))}/>
                      </div>
                    </div>
                    <div className="ig-serial-preview">{fullSerial||"—"}</div>
                    {serialTooLong&&<div className="ig-serial-error">⚠ Exceeds 40 characters</div>}
                    {serialMissing&&<div className="ig-serial-error">Category and Number required</div>}
                  </div>
                  <span className="ig-meta-label req">Invoice Date</span>
                  <input className="ig-field right" type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/>
                  <span className="ig-meta-label req">Date of Supply</span>
                  <input className="ig-field right" type="date" value={supplyDate} onChange={e=>setSupplyDate(e.target.value)}/>
                  <span className="ig-meta-label">Due Date</span>
                  <input className="ig-field right" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
                </div>
              </div>
            </div>

            {/* parties */}
            <div className="ig-parties">
              <div>
                <div className="ig-section-title">Supplier Details</div>
                <FieldGroup label="Registered Business Name" required>
                  <input className="ig-field" value={supplierName} onChange={e=>setSupplierName(e.target.value)} placeholder="Your registered business name"/>
                </FieldGroup>
                <TINInput value={supplierTIN} onChange={setSupplierTIN} placeholder="Supplier TIN (9 digits)"/>
                <FieldGroup label="Registered Address" required>
                  <textarea className="ig-textarea" rows={2} value={supplierAddress} onChange={e=>setSupplierAddress(e.target.value)} placeholder="As per VAT registration certificate"/>
                </FieldGroup>
                <div className="ig-two-col">
                  <FieldGroup label="Email">
                    <input className="ig-field" type="email" value={supplierEmail} onChange={e=>setSupplierEmail(e.target.value)} placeholder="email@example.com"/>
                  </FieldGroup>
                  <FieldGroup label="Phone">
                    <input className="ig-field" type="tel" value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} placeholder="+94 77 000 0000"/>
                  </FieldGroup>
                </div>
              </div>
              <div>
                <div className="ig-section-title">Purchaser Details</div>
                <FieldGroup label="Purchaser Name / Company" required>
                  <input className="ig-field" value={purchaserName} onChange={e=>setPurchaserName(e.target.value)} placeholder="Client name / company"/>
                </FieldGroup>
                <TINInput value={purchaserTIN} onChange={setPurchaserTIN} placeholder="Purchaser TIN (if VAT registered)"/>
                <FieldGroup label="Address" required>
                  <textarea className="ig-textarea" rows={2} value={purchaserAddress} onChange={e=>setPurchaserAddress(e.target.value)} placeholder="As per VAT registration certificate"/>
                </FieldGroup>
              </div>
            </div>

            {/* items */}
            <div className="ig-section-title">Description of Supply</div>
            <div className="ig-items-header">
              <span>Description *</span><span className="num">Qty *</span>
              <span>Unit *</span><span className="num">Rate ({currencyCode})</span>
              <span className="num">Amount ({currencyCode})</span><span/>
            </div>
            {items.map(item=>(
              <LineItemRow key={item.id} item={item} sym={sym} onUpdate={updateItem} onRemove={removeItem}/>
            ))}
            <button className="ig-add-btn" onClick={addItem}>+ Add Line Item</button>

            {/* bottom */}
            <div className="ig-bottom">
              <div>
                <div className="ig-section-title" style={{marginBottom:8}}>Optional Information</div>
                <div className="ig-optional-grid">
                  <FieldGroup label="Mode of Payment">
                    <select className="ig-select-field" value={paymentMode} onChange={e=>setPaymentMode(e.target.value)}>
                      <option value="">— Select —</option>
                      <option>Cash</option><option>Bank Transfer</option>
                      <option>Card</option><option>Cheque</option><option>Online</option>
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Place of Supply">
                    <input className="ig-field" value={placeOfSupply} onChange={e=>setPlaceOfSupply(e.target.value)} placeholder="e.g. Colombo"/>
                  </FieldGroup>
                </div>
                <FieldGroup label="Notes / References">
                  <textarea className="ig-textarea" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Payment instructions, notes…" style={{width:"100%"}}/>
                </FieldGroup>
              </div>
              <div>
                <div className="ig-section-title" style={{marginBottom:8}}>VAT Calculation</div>
                <div className="ig-totals-box">
                  <div className="ig-total-row"><span>Subtotal</span><span>{fmt(sym,subtotal)}</span></div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label">Discount</span>
                    <input className="ig-adj-input" type="number" min="0" value={discVal} onChange={e=>setDiscVal(e.target.value)}/>
                    <select className="ig-adj-select" value={discType} onChange={e=>setDiscType(e.target.value)}>
                      <option value="pct">%</option><option value="flat">flat</option>
                    </select>
                    <span className="ig-adj-value" style={{color:"#dc2626"}}>−{fmt(sym,discAmt)}</span>
                  </div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label">Shipping</span>
                    <input className="ig-adj-input" type="number" min="0" value={shipVal} onChange={e=>setShipVal(e.target.value)}/>
                    <span style={{width:40}}/>
                    <span className="ig-adj-value">{fmt(sym,parseFloat(shipVal)||0)}</span>
                  </div>
                  <div className="ig-total-row emphasis"><span>Value excl. VAT</span><span>{fmt(sym,valueExclVAT)}</span></div>
                  <div className="ig-adj-row">
                    <span className="ig-adj-label" style={{color:"#0f2a5c",fontWeight:600}}>VAT Rate</span>
                    <input className="ig-adj-input" type="number" min="0" max="100" value={vatRate} onChange={e=>setVatRate(e.target.value)}/>
                    <span style={{fontSize:11,color:"#64748b",width:40}}>%</span>
                    <span className="ig-adj-value" style={{color:"#1a3d78",fontWeight:600}}>{fmt(sym,vatAmt)}</span>
                  </div>
                  <div className="ig-total-row grand"><span>Total (incl. VAT)</span><span>{fmt(sym,grandTotal)}</span></div>
                </div>
                <div className="ig-words-box">
                  <div className="ig-words-label">Amount in Words</div>
                  {toWords(grandTotal)} {currencyCode}
                </div>
              </div>
            </div>

            <div className="ig-compliance-footer">
              Issued under the Value Added Tax Act No. 14 of 2002 &nbsp;|&nbsp; Circular SEC/2026/E/03<br/>
              This Tax Invoice must include only VAT-taxable supplies.
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && <PdfModal data={previewData} onClose={()=>setShowPreview(false)}/>}
    </>
  );
}
