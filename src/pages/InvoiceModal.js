import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Edit2, Printer, Download, Check, AlertCircle } from 'lucide-react';
import api from '../utils/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n2 = v => Number(v || 0).toFixed(2);
const fmtINR = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = n => {
    if (n < 20)       return ones[n];
    if (n < 100)      return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000)     return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+convert(n%100) : '');
    if (n < 100000)   return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  };
  const num = Math.floor(Number(amount || 0));
  return num === 0 ? 'Zero Only.' : convert(num).trim() + ' Only.';
}

const dtFmt = d => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
};
const inputFmt = d => d ? new Date(d).toISOString().split('T')[0] : '';
const getFY = d => {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear(), m = dt.getMonth()+1;
  return m >= 4 ? `${y}-${String(y+1).slice(2)}` : `${y-1}-${String(y).slice(2)}`;
};

// ─── Editable field components — defined OUTSIDE main component ───────────────
// CRITICAL: These must stay outside the parent component.
// If defined inside, React treats them as new component types on every render,
// unmounting/remounting them and losing focus after every keystroke.

const EF = ({ val, onChange, editMode, type='text', w, style={} }) => {
  if (!editMode) return <span style={style}>{val || ''}</span>;
  return (
    <input
      type={type}
      value={val || ''}
      onChange={e => onChange(e.target.value)}
      style={{
        border:'1px solid #4285f4', borderRadius:2, padding:'1px 3px',
        fontSize:'inherit', background:'#fffde7', fontFamily:'inherit',
        width: w || 'auto', minWidth:40, ...style
      }}
    />
  );
};

const EDate = ({ val, onChange, editMode }) => {
  if (!editMode) return <span>{dtFmt(val)}</span>;
  return (
    <input
      type="date"
      value={inputFmt(val)}
      onChange={e => onChange(e.target.value)}
      style={{
        border:'1px solid #4285f4', borderRadius:2, padding:'1px 2px',
        fontSize:8, background:'#fffde7', fontFamily:'inherit'
      }}
    />
  );
};

const EText = ({ val, onChange, editMode, rows=3 }) => {
  if (!editMode) return <span style={{ whiteSpace:'pre-line', fontSize:8.5 }}>{val || ''}</span>;
  return (
    <textarea
      value={val || ''}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={{
        width:'100%', border:'1px solid #4285f4', borderRadius:2,
        fontSize:8.5, padding:'1px 3px', background:'#fffde7',
        resize:'vertical', fontFamily:'inherit'
      }}
    />
  );
};

const ENum = ({ val, onChange, editMode, w=52 }) => {
  if (!editMode) return <span>{val}</span>;
  return (
    <input
      type="number"
      value={val}
      onChange={e => onChange(e.target.value)}
      style={{
        width:w, border:'1px solid #4285f4', borderRadius:2, padding:'1px 2px',
        fontSize:8, background:'#fffde7', textAlign:'center', fontFamily:'inherit'
      }}
    />
  );
};

const ESelect = ({ val, onChange, editMode, options }) => {
  if (!editMode) return <span>{val}</span>;
  return (
    <select
      value={val}
      onChange={e => onChange(e.target.value)}
      style={{ border:'1px solid #4285f4', borderRadius:2, fontSize:8, background:'#fffde7', padding:1 }}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const TH = { border:'1px solid #555', padding:'3px 4px', textAlign:'center', background:'#e0e0e0', fontWeight:'bold', fontSize:8 };
const TD = { border:'1px solid #555', padding:'3px 4px', textAlign:'center', fontSize:8.5 };
const overlayStyle = { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:2000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:16 };
const btnOutline = { display:'flex', alignItems:'center', gap:5, padding:'6px 12px', border:'1px solid #bbb', borderRadius:7, background:'#fff', color:'#333', cursor:'pointer', fontSize:12, fontWeight:500 };
const btnSec = { padding:'8px 18px', border:'1px solid #ccc', borderRadius:8, background:'#fff', color:'#444', cursor:'pointer', fontSize:13, fontWeight:500 };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceModal({ order, onClose, onSaved }) {
  const [invoice, setInvoice]         = useState(null);
  const [origInvoice, setOrigInvoice] = useState(null);
  const [editMode, setEditMode]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [saveInfo, setSaveInfo]       = useState('');
  const printRef = useRef();

  useEffect(() => { loadOrCreate(); }, []);

  const loadOrCreate = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if an invoice already exists for this order
      const ex = await api.get(`/invoices/by-order/${order._id}`);
      if (ex.data.data) {
        setInvoice(ex.data.data);
        setOrigInvoice(JSON.parse(JSON.stringify(ex.data.data)));
      } else {
        // Generate new invoice — backend only includes delivered items
        const gen = await api.post(`/invoices/generate/${order._id}`);
        setInvoice(gen.data.data);
        setOrigInvoice(JSON.parse(JSON.stringify(gen.data.data)));
        if (onSaved) onSaved();
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load or generate invoice');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate all item GST amounts whenever price, qty, GST rate or MH flag changes
  const recalc = useCallback((inv) => {
    const mh    = inv.saleWithinMaharashtra;
    const items = (inv.items || []).map(item => {
      const totalValue   = (item.quantity || 0) * (item.rate || 0);
      const discount     = item.discount || 0;
      const taxableValue = totalValue - discount;
      const gstRate      = item.gstRate || 18;
      const cgstRate     = mh ? gstRate/2 : 0;
      const sgstRate     = mh ? gstRate/2 : 0;
      const igstRate     = mh ? 0 : gstRate;
      const cgstAmount   = mh ? (taxableValue * cgstRate)/100 : 0;
      const sgstAmount   = mh ? (taxableValue * sgstRate)/100 : 0;
      const igstAmount   = !mh ? (taxableValue * igstRate)/100 : 0;
      return { ...item, totalValue, taxableValue, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount };
    });
    const subtotal    = items.reduce((s,i) => s + (i.taxableValue||0), 0);
    const totalGst    = items.reduce((s,i) => s + i.cgstAmount + i.sgstAmount + i.igstAmount, 0);
    return { ...inv, items, subtotal, totalGst, totalAmount: subtotal + totalGst };
  }, []);

  // Set a deep nested field e.g. 'billedTo.name'
  const setF = useCallback((path, value) => {
    setInvoice(prev => {
      const u    = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj    = u;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      // Recalculate when MH flag or any numeric field changes
      return path === 'saleWithinMaharashtra' ? recalc(u) : u;
    });
  }, [recalc]);

  // Update a single item field and re-run recalc
  const setItem = useCallback((idx, field, value) => {
    setInvoice(prev => {
      const u = JSON.parse(JSON.stringify(prev));
      u.items[idx][field] = ['quantity','rate','discount','gstRate'].includes(field)
        ? (parseFloat(value) || 0)
        : value;
      return recalc(u);
    });
  }, [recalc]);

  // Build a human-readable summary of what changed vs the original
  const buildChangeMsg = (orig, updated) => {
    if (!orig || !updated) return '';
    const msgs = [];
    const od = Number(orig.totalAmount||0), nd = Number(updated.totalAmount||0);
    if (Math.abs(od - nd) > 0.01)
      msgs.push(`Invoice total: ${fmtINR(od)} → ${fmtINR(nd)}`);
    (updated.items||[]).forEach((item, i) => {
      const oi = (orig.items||[])[i];
      if (!oi) return;
      if (Math.abs((oi.rate||0)-(item.rate||0)) > 0.001)
        msgs.push(`"${item.description}" rate: ${fmtINR(oi.rate)} → ${fmtINR(item.rate)}`);
      if (Math.abs((oi.quantity||0)-(item.quantity||0)) > 0.001)
        msgs.push(`"${item.description}" qty: ${oi.quantity} → ${item.quantity}`);
    });
    return msgs.join(' | ');
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaveInfo('');
    try {
      const res   = await api.put(`/invoices/${invoice._id}`, invoice);
      const saved = res.data.data;
      const msg   = buildChangeMsg(origInvoice, saved);
      setInvoice(saved);
      setOrigInvoice(JSON.parse(JSON.stringify(saved)));
      setEditMode(false);
      setSaveInfo(msg
        ? `✓ Saved. ${msg}. Sales Order & customer balance updated.`
        : '✓ Invoice saved successfully.');
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save invoice');
    } finally { setSaving(false); }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <title></title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:9px;color:#000;background:#fff}
        .wrap{padding:8mm 10mm}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #555;padding:2px 4px;font-size:8.5px}
        input,textarea,select{display:none!important}
        @page{size:A4;margin:0mm;}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style>
    </head><body><div class="wrap">${printRef.current.innerHTML}</div>
    <script>window.onload=function(){ setTimeout(function(){ window.print(); },500); };</script>
    </body></html>`);
    win.document.close();
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={overlayStyle}>
      <div style={{ background:'#fff', padding:48, borderRadius:10, textAlign:'center', color:'#666', marginTop:80 }}>
        <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-gray-400" style={{ display:'block', margin:'0 auto 12px' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#888" strokeWidth="4"/>
          <path fill="#888" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Generating invoice…
      </div>
    </div>
  );

  // ── Error state (no delivered items, or network error) ───────────────────────
  if (!invoice) return (
    <div style={overlayStyle}>
      <div style={{ background:'#fff', padding:32, borderRadius:10, maxWidth:440, textAlign:'center', marginTop:80 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
        <div style={{ color:'#c00', fontWeight:600, fontSize:15, marginBottom:8 }}>
          {error || 'Could not load invoice'}
        </div>
        {error?.toLowerCase().includes('delivered') && (
          <div style={{ color:'#666', fontSize:13, marginBottom:16 }}>
            Go back and mark the items you want to invoice as "Delivered" first,
            then try again.
          </div>
        )}
        <button onClick={onClose} style={{ ...btnSec, margin:'0 auto' }}>Close</button>
      </div>
    </div>
  );

  // ── Invoice render ───────────────────────────────────────────────────────────
  const mh        = invoice.saleWithinMaharashtra;
  const totalQty  = (invoice.items||[]).reduce((s,i) => s+(i.quantity||0), 0);
  const cgstTotal = (invoice.items||[]).reduce((s,i) => s+(i.cgstAmount||0), 0);
  const sgstTotal = (invoice.items||[]).reduce((s,i) => s+(i.sgstAmount||0), 0);
  const igstTotal = (invoice.items||[]).reduce((s,i) => s+(i.igstAmount||0), 0);
  const fy        = getFY(invoice.invoiceDate);
  const em        = editMode;

  return (
    <div style={overlayStyle}>
      <div style={{ background:'#fff', borderRadius:10, width:'100%', maxWidth:1100, boxShadow:'0 8px 40px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', maxHeight:'96vh' }}>

        {/* ── Toolbar ── */}
        <div style={{ padding:'10px 18px', borderBottom:'1px solid #e0e0e0', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8f8f8', borderRadius:'10px 10px 0 0', flexShrink:0, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700 }}>GST Tax Invoice — AMPPERE CABLE</div>
            <div style={{ fontSize:11, color:'#888' }}>
              {invoice.items?.length} item(s) · Only delivered items are invoiced · Rate/qty edits sync back to Sales Order on save
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', background:mh?'#e8f5e9':'#fff3e0', padding:'5px 10px', borderRadius:6, border:'1px solid #bbb' }}>
              <input type="checkbox" checked={mh} onChange={e => setF('saleWithinMaharashtra', e.target.checked)} />
              <strong>Sale within Maharashtra</strong>
              <span style={{ color:'#777', fontSize:10 }}>(CGST+SGST)</span>
            </label>
            <button
              onClick={() => { setEditMode(!em); setError(''); setSaveInfo(''); }}
              style={{ ...btnOutline, color:em?'#1565c0':'#333', background:em?'#e3f2fd':'#fff' }}>
              <Edit2 size={13}/> {em ? 'Editing…' : 'Edit Invoice'}
            </button>
            <button onClick={handlePrint} style={btnOutline}><Printer size={13}/> Print</button>
            <button onClick={handlePrint} style={{ ...btnOutline, background:'#1a1a2e', color:'#fff', border:'none' }}>
              <Download size={13}/> Download PDF
            </button>
            <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer' }}>
              <X size={20} color="#666"/>
            </button>
          </div>
        </div>

        {/* ── Banners ── */}
        {error && (
          <div style={{ margin:'8px 18px 0', padding:'8px 12px', background:'#fce8e6', color:'#c00', borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
            <AlertCircle size={14}/> {error}
          </div>
        )}
        {saveInfo && !error && (
          <div style={{ margin:'8px 18px 0', padding:'8px 12px', background:'#e8f5e9', color:'#2e7d32', borderRadius:6, fontSize:12, fontWeight:500 }}>
            {saveInfo}
          </div>
        )}

        {/* ── Scrollable invoice body ── */}
        <div style={{ overflowY:'auto', padding:'14px 18px', flex:1 }}>
          <div style={{ border:'2px solid #777', background:'#fff', padding:12, minWidth:860 }}>
            <div ref={printRef} style={{ fontFamily:'Arial,sans-serif', fontSize:9, color:'#000' }}>

              {/* ===== HEADER ===== */}
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:2 }}>
                <tbody><tr>
                  <td style={{ border:'none', verticalAlign:'top' }}>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:4 }}>
                      <img src="/assets/amp-logo.png" alt="AMP company logo" style={{ height:42, width:'auto', objectFit:'contain', display:'block' }} />
                      <div>
                        <div style={{ fontSize:32, fontWeight:900, color:'#cc0000', letterSpacing:0.5, lineHeight:1 }}>
                          AMPPERE CABLE
                        </div>
                        <div style={{ fontSize:12, fontStyle:'italic', fontWeight:700, color:'#333', marginTop:1 }}>
                          Where Quality Meets Reliability
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize:7.5, marginTop:3, fontWeight:'bold' }}>
                      FACTORY SHED NO. 28 A/1&amp;2, SURVEY NO.47, HI-TECH INDSTRL. AREA, VILLAGE ALYALI, TAL, DIST: PALGHAR.401404.
                    </div>
                    <div style={{ fontSize:7.5, fontWeight:'bold' }}>
                      MO.NO.9370946510,&nbsp; WHATSAPP NO. 9975812595,&nbsp; email id infoampperecable@gmail.com&nbsp; https://ampperecable.in
                    </div>
                  </td>
                  <td style={{ border:'none', verticalAlign:'top', textAlign:'right', width:165 }}>
                    <div style={{ display:'flex', gap:5, justifyContent:'flex-end', alignItems:'center' }}>
                      <img src="/assets/rohs.jpg" alt="RoHS" style={{ height:52, width:'auto', objectFit:'contain', display:'block' }} />
                      <img src="/assets/iso.png" alt="ISO 9001:2015" style={{ height:52, width:'auto', objectFit:'contain', display:'block' }} />
                      <img src="/assets/UL.jpeg" alt="UL" style={{ height:52, width:'auto', objectFit:'contain', display:'block' }} />
                    </div>
                  </td>
                </tr></tbody>
              </table>

              <div style={{ borderTop:'2px dashed #888', margin:'4px 0 5px' }}/>

              {/* ===== GST INFO ROWS ===== */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  <tr>
                    <td colSpan={2} style={{ border:'1px solid #555', textAlign:'center', fontWeight:'bold', fontSize:12, padding:'4px 0', background:'#f0f0f0' }}>
                      GST TAX INVOICE
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:5, width:'55%' }}>
                      <div style={{ marginBottom:2 }}>
                        <span style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 4px', fontSize:9 }}>GSTIN No : 27BPZPS6527R1ZD</span>
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5 }}><strong>Tax Payable on Reverse Charge : (Yes/No)</strong></div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <strong>Invoice Serial No. :</strong>
                        <EF val={invoice.invoiceNumber} onChange={v=>setF('invoiceNumber',v)} editMode={em} w={95}/>
                        <strong>year - {fy}</strong>
                      </div>
                      <div style={{ fontSize:8.5, display:'flex', alignItems:'center', gap:6 }}>
                        <strong>Invoice Date :</strong>
                        <EDate val={invoice.invoiceDate} onChange={v=>setF('invoiceDate',v)} editMode={em}/>
                      </div>
                    </td>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:5 }}>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <strong>Name of Transporter:</strong>
                        <EF val={invoice.transporterName} onChange={v=>setF('transporterName',v)} editMode={em} w={110}/>
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', gap:12, flexWrap:'wrap' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <strong>LR No :</strong>
                          <EF val={invoice.lrNo} onChange={v=>setF('lrNo',v)} editMode={em} w={70}/>
                        </span>
                        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <strong>LR Date :</strong>
                          <EDate val={invoice.lrDate} onChange={v=>setF('lrDate',v)} editMode={em}/>
                        </span>
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:5 }}>
                        <strong>Vehicle No. :</strong>
                        <EF val={invoice.vehicleNo} onChange={v=>setF('vehicleNo',v)} editMode={em} w={90}/>
                      </div>
                      <div style={{ fontSize:8.5, display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <strong>Date &amp; Time of Supply :</strong>
                        <EDate val={invoice.dateOfSupply} onChange={v=>setF('dateOfSupply',v)} editMode={em}/>
                        <strong>at</strong> <strong>Hrs</strong>
                      </div>
                    </td>
                  </tr>

                  {/* Billed To / Delivery At */}
                  <tr>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:5 }}>
                      <div style={{ background:'#e1e1e1', fontWeight:'bold', fontSize:11, textAlign:'center', padding:'3px 0', marginBottom:4 }}>
                        Billed To
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:5 }}>
                        <strong>Name :</strong>
                        <EF val={invoice.billedTo?.name} onChange={v=>setF('billedTo.name',v)} editMode={em} w={200}/>
                      </div>
                      <div style={{ marginBottom:3, fontSize:8.5 }}>
                        <EText val={invoice.billedTo?.address} onChange={v=>setF('billedTo.address',v)} editMode={em} rows={3}/>
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <strong>P.O.No.:</strong>
                        <EF val={invoice.poNumber} onChange={v=>setF('poNumber',v)} editMode={em} w={90}/>
                        <strong>dt.</strong>
                        <EDate val={invoice.poDate} onChange={v=>setF('poDate',v)} editMode={em}/>
                      </div>
                      <div style={{ fontSize:9, fontWeight:'bold', display:'flex', alignItems:'center', gap:5 }}>
                        <strong>Party's GSTIN No :</strong>
                        <EF val={invoice.billedTo?.gstNumber} onChange={v=>setF('billedTo.gstNumber',v)} editMode={em} w={130}/>
                      </div>
                    </td>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:5 }}>
                      <div style={{ background:'#ffff00', fontWeight:'bold', fontSize:11, textAlign:'center', padding:'3px 0', marginBottom:4 }}>
                        Shipped T
                      </div>
                      <div style={{ marginBottom:2, fontSize:8.5, display:'flex', alignItems:'center', gap:5 }}>
                        <strong>Name :</strong>
                        <EF val={invoice.deliveryAt?.name} onChange={v=>setF('deliveryAt.name',v)} editMode={em} w={200}/>
                      </div>
                      <div style={{ marginBottom:3, fontSize:8.5 }}>
                        <EText val={invoice.deliveryAt?.address} onChange={v=>setF('deliveryAt.address',v)} editMode={em} rows={3}/>
                      </div>
                      <div style={{ fontSize:8.5, display:'flex', alignItems:'center', gap:5 }}>
                        <strong>contact</strong>
                        <EF val={invoice.deliveryAt?.contact} onChange={v=>setF('deliveryAt.contact',v)} editMode={em} w={130}/>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ===== ITEMS TABLE ===== */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#e0e0e0' }}>
                    <th rowSpan={3} style={TH}>Sr.<br/>No.</th>
                    <th rowSpan={3} style={{ ...TH, textAlign:'left', minWidth:110 }}>Description of Goods</th>
                    <th rowSpan={3} style={TH}>HSN<br/>Code</th>
                    <th rowSpan={3} style={TH}>U.O.M.</th>
                    <th rowSpan={3} style={TH}>Quantity</th>
                    <th rowSpan={3} style={TH}>Rate<br/>per mtr.</th>
                    <th rowSpan={3} style={TH}>Total<br/>value</th>
                    <th rowSpan={3} style={TH}>Discount<br/>if any</th>
                    <th rowSpan={3} style={TH}>Taxable<br/>Value</th>
                    <th colSpan={2} style={{ ...TH, background:!mh?'#c3e6cb':'#e0e0e0' }}>IGST</th>
                    <th colSpan={2} style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>CGST</th>
                    <th colSpan={2} style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>SGST</th>
                  </tr>
                  <tr>
                    <th colSpan={2} style={{ ...TH, background:!mh?'#c3e6cb':'#e0e0e0', fontSize:7 }}>Sale out of State</th>
                    <th colSpan={4} style={{ ...TH, background:mh?'#b8daff':'#e0e0e0', fontSize:7 }}>Sale within Maharashtra</th>
                  </tr>
                  <tr>
                    <th style={{ ...TH, background:!mh?'#c3e6cb':'#e0e0e0' }}>Rate</th>
                    <th style={{ ...TH, background:!mh?'#c3e6cb':'#e0e0e0' }}>Amount</th>
                    <th style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>Rate</th>
                    <th style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>Amount</th>
                    <th style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>Rate</th>
                    <th style={{ ...TH, background:mh?'#b8daff':'#e0e0e0' }}>Amount</th>
                  </tr>
                  <tr>
                    <td style={TD}></td>
                    <td style={{ ...TD, textAlign:'left', fontSize:7.5, fontStyle:'italic' }}>PVC INSULATED<br/>WIRES &amp; CABLES</td>
                    <td style={TD}></td>
                    <td style={{ ...TD, fontSize:7.5 }}>mtr</td>
                    <td style={TD}></td>
                    <td style={{ ...TD, fontSize:7.5 }}>in Rs.</td>
                    <td style={TD}></td>
                    <td style={{ ...TD, fontSize:7.5 }}>nil</td>
                    <td style={TD}></td>
                    <td style={{ ...TD, fontSize:7.5, color:'#888' }}>n.a.</td>
                    <td style={TD}/><td style={TD}/><td style={TD}/><td style={TD}/><td style={TD}/>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items||[]).map((item, idx) => (
                    <tr key={item._id || idx}>
                      <td style={{ ...TD, textAlign:'center', fontWeight:'bold' }}>{idx+1}</td>
                      <td style={{ ...TD, textAlign:'left' }}>
                        <EF val={item.description} onChange={v=>setItem(idx,'description',v)} editMode={em}
                            style={{ width:'100%', fontSize:8.5, fontWeight:'bold' }}/>
                      </td>
                      <td style={TD}>
                        <EF val={item.hsnCode} onChange={v=>setItem(idx,'hsnCode',v)} editMode={em} w={44}/>
                      </td>
                      <td style={TD}>
                        <ESelect val={item.uom||'METER'} onChange={v=>setItem(idx,'uom',v)} editMode={em}
                                 options={['METER','KG','PCS','SET','NOS']}/>
                      </td>
                      <td style={TD}>
                        <ENum val={item.quantity} onChange={v=>setItem(idx,'quantity',v)} editMode={em} w={52}/>
                      </td>
                      <td style={{ ...TD, background:em?'#fffff5':'transparent' }}>
                        <ENum val={item.rate} onChange={v=>setItem(idx,'rate',v)} editMode={em} w={50}/>
                      </td>
                      <td style={TD}>{n2(item.totalValue)}</td>
                      <td style={TD}>
                        <ENum val={item.discount||0} onChange={v=>setItem(idx,'discount',v)} editMode={em} w={40}/>
                      </td>
                      <td style={{ ...TD, fontWeight:600 }}>{n2(item.taxableValue)}</td>
                      <td style={{ ...TD, background:!mh?'#f0fff4':'#fafafa', color:!mh?'#000':'#bbb' }}>{!mh?`${item.igstRate}%`:''}</td>
                      <td style={{ ...TD, background:!mh?'#f0fff4':'#fafafa', color:!mh?'#000':'#bbb', fontWeight:!mh?600:400 }}>{!mh?n2(item.igstAmount):''}</td>
                      <td style={{ ...TD, background:mh?'#f0f8ff':'#fafafa', color:mh?'#000':'#bbb' }}>{mh?`${item.cgstRate}%`:''}</td>
                      <td style={{ ...TD, background:mh?'#f0f8ff':'#fafafa', color:mh?'#000':'#bbb', fontWeight:mh?600:400 }}>{mh?n2(item.cgstAmount):''}</td>
                      <td style={{ ...TD, background:mh?'#f0f8ff':'#fafafa', color:mh?'#000':'#bbb' }}>{mh?`${item.sgstRate}%`:''}</td>
                      <td style={{ ...TD, background:mh?'#f0f8ff':'#fafafa', color:mh?'#000':'#bbb', fontWeight:mh?600:400 }}>{mh?n2(item.sgstAmount):''}</td>
                    </tr>
                  ))}

                  {/* Grand total row */}
                  <tr style={{ fontWeight:'bold', background:'#ececec' }}>
                    <td colSpan={4} style={{ ...TD, textAlign:'center' }}>
                      {totalQty} {(invoice.items?.[0]?.uom === 'METER' || !invoice.items?.[0]?.uom) ? 'MTR' : invoice.items?.[0]?.uom}
                    </td>
                    <td style={TD}/><td style={TD}/><td style={TD}/><td style={TD}/>
                    <td style={{ ...TD, fontWeight:'bold', fontSize:9.5 }}>{n2(invoice.subtotal)}</td>
                    <td style={{ ...TD, background:!mh?'#c3e6cb':'#fafafa' }}>{!mh?'18%':''}</td>
                    <td style={{ ...TD, background:!mh?'#c3e6cb':'#fafafa', fontWeight:'bold' }}>{!mh?n2(igstTotal):''}</td>
                    <td style={{ ...TD, background:mh?'#b8daff':'#fafafa' }}>{mh?'9%':''}</td>
                    <td style={{ ...TD, background:mh?'#b8daff':'#fafafa', fontWeight:'bold' }}>{mh?n2(cgstTotal):''}</td>
                    <td style={{ ...TD, background:mh?'#b8daff':'#fafafa' }}>{mh?'9%':''}</td>
                    <td style={{ ...TD, background:mh?'#b8daff':'#fafafa', fontWeight:'bold' }}>{mh?n2(sgstTotal):''}</td>
                  </tr>
                </tbody>
              </table>

              {/* ===== BOTTOM ===== */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  <tr>
                    <td colSpan={2} style={{ border:'1px solid #555', background:'#ffff00', fontWeight:'bold', padding:'3px 6px', fontSize:8.5 }}>
                      Rupees : {toWords(invoice.totalAmount).toUpperCase()}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:6, width:'58%' }}>
                      <div style={{ marginBottom:2 }}>
                        <span style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 4px', fontSize:8.5 }}>GSTIN No : 27BPZPS6527R1ZD</span>
                      </div>
                      <div style={{ marginBottom:1, fontSize:8.5 }}><strong>PAN:</strong> BPZPS6527R</div>
                      <div style={{ marginBottom:2 }}>
                        <span style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 3px', fontSize:7.5 }}>MSME UDYOG AADHAAR No.: MH17A0040992.(UDYAM-MH-17-0004470.)</span>
                      </div>
                      <div style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 3px', marginBottom:1, fontSize:7.5 }}>AMPPERE CABLE, C.C.ACCOUNT, PUNJAB NATIONAL BANK, BOISAR BRANCH,</div>
                      <div style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 3px', marginBottom:6, fontSize:7.5 }}>CC A/C. NO. 16634011000015B, IFS CODE: PUNB0166310. Mo.No: 9370946510</div>
                      <div style={{ borderTop:'1px solid #ccc', paddingTop:4 }}>
                        <div style={{ fontSize:7.5, marginBottom:2, fontWeight:'bold' }}>Amount of Tax subject to Reverse Charge</div>
                        <div style={{ fontSize:7, marginBottom:3 }}>Certified that the particulars given above and the amount indicated are true and correct</div>
                        <div style={{ fontSize:7 }}>
                          a) represent the price actually charged and that there is no additional flow or consideration
                          <div style={{ textAlign:'center' }}>directly or indirectly from the buyer OR</div>
                          b) is provisional as additional consideration will be received from the buyer on account of
                          <div style={{ textAlign:'center' }}>terms and conditions of Sale</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ border:'1px solid #555', verticalAlign:'top', padding:0 }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ border:'1px solid #ccc', padding:'3px 6px', fontSize:8.5, fontWeight:'bold' }}>Sub Total</td>
                            <td style={{ border:'1px solid #ccc', padding:'3px 6px', fontSize:8.5, textAlign:'right', fontWeight:'bold' }}>{n2(invoice.subtotal)}</td>
                          </tr>
                          {[
                            ['Freight Charges','freightCharges'],
                            ['Packing &amp; Forwarding Charges','packingCharges'],
                            ['Insurance Charges','insuranceCharges'],
                            ['Other Charges/Rounded off','otherCharges'],
                          ].map(([label, field]) => (
                            <tr key={field}>
                              <td style={{ border:'1px solid #ccc', padding:'3px 6px', fontSize:8 }} dangerouslySetInnerHTML={{ __html:label }}/>
                              <td style={{ border:'1px solid #ccc', padding:'3px 6px', textAlign:'right', fontSize:8 }}>
                                <EF val={invoice[field]} onChange={v=>setF(field,v)} editMode={em} w={60} style={{ textAlign:'right' }}/>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background:'#ececec' }}>
                            <td style={{ border:'1px solid #555', padding:'4px 6px', fontWeight:'bold', fontSize:10 }}>Invoice Total</td>
                            <td style={{ border:'1px solid #555', padding:'4px 6px', fontWeight:'bold', fontSize:14, textAlign:'right' }}>{n2(invoice.totalAmount)}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ border:'1px solid #555', padding:'16px 6px', textAlign:'center', fontSize:8, color:'#888' }}>Electronic Reference Number</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ border:'1px solid #555', padding:'6px 8px', textAlign:'right' }}>
                              <div style={{ fontWeight:'bold', fontSize:11, marginBottom:30 }}>For AMPPERE CABLE</div>
                              <div style={{ borderTop:'1px solid #333', paddingTop:3 }}>
                                <div style={{ fontSize:8.5 }}>Authorised Signatory</div>
                                <div style={{ fontSize:8.5, fontWeight:'bold' }}>Name : Mr. Sandeep Sawant.</div>
                                <div style={{ fontSize:8.5 }}>Designation Proprietor</div>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Terms */}
                  <tr>
                    <td colSpan={2} style={{ border:'1px solid #555', padding:'4px 8px' }}>
                      <ol style={{ paddingLeft:14, margin:0 }}>
                        {[
                          'Goods once sold will not be taken back or exchanged.',
                          'Seller is not responsible for any loss or damage of goods in transit.',
                          'Insurance of the above goods to be borne by the buyer. Seller not liable.',
                          'Buyer undertakes to submit prescribed ST declaration to seller on demand.',
                          'Disputes if any will be subject to sellers court of jurisdiction. ( Palghar Jurisdiction )',
                        ].map((t,i) => <li key={i} style={{ fontSize:7.5, marginBottom:1 }}>{t}</li>)}
                      </ol>
                    </td>
                  </tr>

                  {/* Special remark */}
                  <tr>
                    <td colSpan={2} style={{ border:'1px solid #555', padding:'4px 8px' }}>
                      <span style={{ background:'#ffff00', fontWeight:'bold', padding:'1px 4px', fontSize:8.5 }}>special remark ( If Any ) :</span>
                      &nbsp;
                      <EF val={invoice.specialRemark} onChange={v=>setF('specialRemark',v)} editMode={em} w={300}/>
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>{/* /printRef */}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:'10px 18px', borderTop:'1px solid #e0e0e0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8f8f8', borderRadius:'0 0 10px 10px', flexShrink:0 }}>
          <div style={{ fontSize:11, color:'#e65100', maxWidth:520 }}>
            {em && '⚠️ Changing price/qty of delivered items will recalculate the Sales Order total & customer balance on save.'}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={btnSec}>Close</button>
            {em && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 22px', border:'none', borderRadius:8, background:saving?'#94a3b8':'#1a73e8', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:13, fontWeight:600 }}>
                <Check size={14}/> {saving ? 'Saving & Syncing…' : 'Save Invoice'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
