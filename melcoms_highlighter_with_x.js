// ==UserScript==
// @name        Highlighter with X – Edge 140 Fix (final)
// @namespace   https://www.melcom-music.de/p/my-samples.html#highlighter
// @version     1.3.0
// @description Highlight text in yellow/green/red with hover-X removal; auto-save & restore; compatible with Edge 140+
// @match       *://*/*
// @run-at      document_idle
// @grant       none
// ==/UserScript==

(function () {
  'use strict';

  const COLORS = { yellow:'#fff3a3', green:'#bbf7d0', red:'#fecacb' };
  const BORDERS = { yellow:'#e6cf69', green:'#7dd3ae', red:'#fda4af' };
  const KEY = 'tm-hi:' + location.href;
  const STYLE_ID = 'tm-highlighter-style';

  function hexToRgba(hex,a){
    const h=hex.replace('#',''), f=h.length===3?h.split('').map(c=>c+c).join(''):h;
    const n=parseInt(f,16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style'); s.id=STYLE_ID;
    s.textContent = `
      .tm-highlight{
        display:inline-block;
        position:relative;
        color:#000!important;
        border-radius:3px;
        padding:0 2px;
        border:1px solid ${BORDERS.yellow};
        background-color:${COLORS.yellow};
        box-shadow:inset 0 0 0 9999px ${hexToRgba(COLORS.yellow,0.4)};
        transition:box-shadow .15s ease;
        margin-right:1px;
      }
      .tm-highlight[data-color="yellow"]{
        border-color:${BORDERS.yellow};
        background-color:${COLORS.yellow};
        box-shadow:inset 0 0 0 9999px ${hexToRgba(COLORS.yellow,0.4)};
      }
      .tm-highlight[data-color="green"]{
        border-color:${BORDERS.green};
        background-color:${COLORS.green};
        box-shadow:inset 0 0 0 9999px ${hexToRgba(COLORS.green,0.4)};
      }
      .tm-highlight[data-color="red"]{
        border-color:${BORDERS.red};
        background-color:${COLORS.red};
        box-shadow:inset 0 0 0 9999px ${hexToRgba(COLORS.red,0.4)};
      }
      .tm-highlight .tm-x{
        position:absolute;
        top:-8px;
        right:-8px;
        width:20px;
        height:20px;
        line-height:20px;
        text-align:center;
        background:rgba(0,0,0,.85);
        color:#fff;
        border-radius:50%;
        font-size:14px;
        cursor:pointer;
        display:none;
        user-select:none;
        z-index:2147483647;
        border:1px solid #fff;
      }
      .tm-highlight:hover .tm-x,
      .tm-highlight:focus-within .tm-x {
        display:inline-block;
      }
    `;
    document.documentElement.appendChild(s);
  }

  function unwrapHighlight(sp){
    if(!sp||!sp.classList.contains('tm-highlight')) return;
    const p=sp.parentNode, frag=document.createDocumentFragment();
    Array.from(sp.childNodes).forEach(n=>{
      if(n.nodeType===1 && n.classList.contains('tm-x')) return;
      frag.appendChild(n);
    });
    p.replaceChild(frag,sp); p.normalize();
  }

  function makeX(wrapper){
    const x=document.createElement('span');
    x.className='tm-x'; x.textContent='×'; x.title='Remove highlight';
    x.addEventListener('click',e=>{
      e.stopPropagation();e.preventDefault();
      unwrapHighlight(wrapper);
      saveHighlightsDeferred();
    });
    return x;
  }

  function highlightSelection(color='yellow'){
    const sel=window.getSelection();
    if(!sel||sel.isCollapsed) return;
    const range=sel.getRangeAt(0);
    const frag=range.extractContents();
    if(frag.querySelectorAll) frag.querySelectorAll('.tm-highlight').forEach(unwrapHighlight);
    const wrapper=document.createElement('span');
    wrapper.className='tm-highlight';
    wrapper.setAttribute('data-color',color);
    wrapper.appendChild(frag);
    wrapper.appendChild(makeX(wrapper));
    range.insertNode(wrapper);
    sel.removeAllRanges();
    saveHighlightsDeferred();
  }

  function clearSelectionHighlights(){
    const sel=window.getSelection();
    if(!sel||sel.isCollapsed) return;
    const r=sel.getRangeAt(0).getBoundingClientRect();
    document.querySelectorAll('.tm-highlight').forEach(sp=>{
      const b=sp.getBoundingClientRect();
      const overlap=!(b.right<r.left||b.left>r.right||b.bottom<r.top||b.top>r.bottom);
      if(overlap) unwrapHighlight(sp);
    });
    saveHighlightsDeferred();
  }

  function installHandlers(){
    document.addEventListener('keydown',e=>{
      const t=e.target, typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
      if(typing) return;
      if(e.altKey&&e.key==='1'){ e.preventDefault(); highlightSelection('yellow'); }
      if(e.altKey&&e.key==='2'){ e.preventDefault(); highlightSelection('green'); }
      if(e.altKey&&e.key==='3'){ e.preventDefault(); highlightSelection('red'); }
      if(e.altKey&&e.key==='0'){ e.preventDefault(); clearSelectionHighlights(); }
    },{capture:true});
  }

  function saveHighlights(){
    try {
      const spans = [];
      document.querySelectorAll('.tm-highlight').forEach(sp=>{
        spans.push({ text: sp.textContent.replace('×',''), color: sp.getAttribute('data-color') });
      });
      localStorage.setItem(KEY, JSON.stringify(spans));
    } catch(e){ console.error(e); }
  }

  let saveTimer=null;
  function saveHighlightsDeferred(){
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveHighlights, 200);
  }

  function restoreHighlights(){
    try {
      const saved = localStorage.getItem(KEY);
      if(!saved) return;
      const spans = JSON.parse(saved);
      if(!Array.isArray(spans)) return;
      spans.forEach(item=>{
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        while(walker.nextNode()){
          const node = walker.currentNode;
          if(node.nodeValue && node.nodeValue.includes(item.text)){
            const idx = node.nodeValue.indexOf(item.text);
            if(idx > -1){
              const before = node.nodeValue.slice(0, idx);
              const match = node.nodeValue.slice(idx, idx + item.text.length);
              const after = node.nodeValue.slice(idx + item.text.length);
              const frag = document.createDocumentFragment();
              if(before) frag.appendChild(document.createTextNode(before));
              const wrapper = document.createElement('span');
              wrapper.className='tm-highlight';
              wrapper.setAttribute('data-color', item.color);
              wrapper.appendChild(document.createTextNode(match));
              wrapper.appendChild(makeX(wrapper));
              frag.appendChild(wrapper);
              if(after) frag.appendChild(document.createTextNode(after));
              node.parentNode.replaceChild(frag, node);
              break;
            }
          }
        }
      });
    } catch(e){ console.error(e); }
  }

  function init(){
    injectStyles();
    restoreHighlights();
    installHandlers();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const observer = new MutationObserver(()=>{ installHandlers(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });

})();
