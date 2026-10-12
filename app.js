const config = window.BAD_ROSES_CONFIG || {};
const pages = ["home","database","waitlist","socials","spirit","championship","privacy"];
let archive = Array.isArray(window.BAD_ROSES_DATABASE) ? window.BAD_ROSES_DATABASE : [];
let activeCategory = "All";
let activeSubcategory = "All";
let searchTerm = "";
let visibleLimit = 48;
let filteredItems = [];
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const friendlyKey = key => String(key).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]/g," ").replace(/\b\w/g, c => c.toUpperCase());
const isPlaceholder = value => !value || /REPLACE_WITH/i.test(value);
function configureLinks(){
  $$("[data-link]").forEach(link=>{
    const key=link.dataset.link, value=config[key];
    if(value) link.href=value;
    if(isPlaceholder(value)){
      link.href="#";
      link.addEventListener("click",event=>{
        event.preventDefault();
        alert("Add your real "+key.replace(/([A-Z])/g," $1").toLowerCase()+" link in site-config.js before publishing.");
      });
    }
  });
  document.title = `${config.clubName || "Bad Roses"} — Star Stable Community`;
}
function setPage(page, updateHash=true){
  if(!pages.includes(page)) page="home";
  $$(".page").forEach(section=>section.classList.toggle("active",section.dataset.section===page));
  $$(".nav-link").forEach(link=>link.classList.toggle("active",link.dataset.page===page));
  $("#mainNav")?.classList.remove("open");
  $("#menuToggle")?.setAttribute("aria-expanded","false");
  if(updateHash && location.hash !== `#${page}`) history.replaceState(null,"",`#${page}`);
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="database" && !archive.length) loadArchive();
}
let archiveLoading = false;
let archiveLoaded = false;
function loadArchive(){
  if (archiveLoading || archiveLoaded) return;
  // The database is bundled into database-data.js. Prefer it so local Python
  // servers and static hosting do not depend on a separate fetch request.
  if (Array.isArray(window.BAD_ROSES_DATABASE) && window.BAD_ROSES_DATABASE.length) {
    archive = window.BAD_ROSES_DATABASE;
  }
  if (archive.length) {
    archiveLoaded = true;
    updateCategoryCounts();
    renderPreview();
    applyFilters();
    return;
  }
  archiveLoading = true;
  const resultCount = $("#resultCount");
  const tableBody = $("#databaseTableBody");
  if (resultCount) resultCount.textContent = "Loading archive…";
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="12" class="table-loading">Loading database…</td></tr>';
  fetch(new URL("database.json", document.baseURI).href)
    .then(response=>{
      if(!response.ok) throw new Error("Could not load database.json (HTTP " + response.status + ")");
      return response.json();
    })
    .then(data=>{
      if(!Array.isArray(data)) throw new Error("database.json must contain a JSON array");
      archive=data;
      archiveLoaded = true;
      updateCategoryCounts();
      renderPreview();
      applyFilters();
    })
    .catch(error=>{
      console.error("[Bad Roses] Database failed to load:", error);
      const resultCount = $("#resultCount");
      const tableBody = $("#databaseTableBody");
      const pageSummary = $("#pageSummary");
      if (resultCount) resultCount.textContent = "The archive could not load";
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="12" class="table-loading">Could not load database. Make sure database-data.js and database.json are in the same folder as index.html.</td></tr>';
      if (pageSummary) pageSummary.textContent = "";
    })
    .finally(()=>{ archiveLoading = false; });
}
function updateCategoryCounts(){
  const counts={"All":archive.length};
  archive.forEach(item=>counts[item.category]=(counts[item.category]||0)+1);
  $$("[data-count]").forEach(el=>el.textContent=(counts[el.dataset.count]||0).toLocaleString());
  $("#resultCount").textContent=`${archive.length.toLocaleString()} entries in the archive`;
}
function renderPreview(){
  const host=$("#homePreview");
  if(!host || !archive.length) return;
  const selected=["Horses & Pets","Clothes","Equipment","Horse Decorations"].map(category=>archive.find(item=>item.category===category && item.image)).filter(Boolean);
  host.innerHTML=selected.map(item=>`<a class="preview-item" href="#database" data-preview-item="${escapeHTML(item.id)}"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" referrerpolicy="no-referrer"><span class="preview-item-copy"><span>${escapeHTML(item.category)}</span><strong>${escapeHTML(item.title)}</strong></span></a>`).join("");
  $$("[data-preview-item]",host).forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();
    setPage("database");
    setTimeout(()=>showItem(link.dataset.previewItem),50);
  }));
}
function normalized(item){
  return [item.title,item.category,item.subcategory,item.description,...Object.entries(item.attributes||{}).flatMap(([k,v])=>[k,v])].join(" ").toLocaleLowerCase();
}
function applyFilters(){
  if(!archive.length) return;
  const term=searchTerm.trim().toLocaleLowerCase();
  filteredItems=archive.filter(item=>
    (activeCategory==="All"||item.category===activeCategory) &&
    (activeSubcategory==="All"||item.subcategory===activeSubcategory) &&
    (!term||normalized(item).includes(term))
  );
  const sort=$("#sortSelect")?.value || "title";
  filteredItems.sort((a,b)=>{
    if(sort==="title-desc") return b.title.localeCompare(a.title);
    if(sort==="category") return a.category.localeCompare(b.category)||a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
  visibleLimit=60;
  renderTable();
  renderSubcategories();
}
function getTableColumns(){
  const common=["SC","JS","Lvl","Speed","Strength","Agil","Disc","Endu","Ride","Jump","Cmd","Care","Site/shop"];
  const used=new Set();
  filteredItems.slice(0,visibleLimit).forEach(item=>Object.keys(item.attributes||{}).forEach(key=>used.add(key)));
  return common.filter(key=>used.has(key));
}
function renderSubcategories(){
  const host=$("#subcategories");
  const categories=activeCategory==="All"?[]:[...new Set(archive.filter(item=>item.category===activeCategory).map(item=>item.subcategory))].sort((a,b)=>a.localeCompare(b));
  if(!categories.length){host.innerHTML="";return;}
  host.innerHTML=[`<button class="subcategory-chip ${activeSubcategory==="All"?"active":""}" data-subcategory="All">All types</button>`,
    ...categories.map(category=>`<button class="subcategory-chip ${activeSubcategory===category?"active":""}" data-subcategory="${escapeHTML(category)}">${escapeHTML(category)}</button>`)].join("");
  $$("[data-subcategory]",host).forEach(button=>button.addEventListener("click",()=>{
    activeSubcategory=button.dataset.subcategory;
    applyFilters();
  }));
}
function renderTable(){
  const columns=getTableColumns();
  const head=$("#databaseTableHead");
  const body=$("#databaseTableBody");
  head.innerHTML=`<tr><th class="thumb-col">Image</th><th class="name-col">Name</th><th>Category</th><th>Type</th>${columns.map(key=>`<th>${escapeHTML(friendlyKey(key))}</th>`).join("")}</tr>`;
  const shown=filteredItems.slice(0,visibleLimit);
  if(!shown.length){
    body.innerHTML=`<tr><td colspan="${4+columns.length}" class="table-loading">No entries found.</td></tr>`;
  }else{
    body.innerHTML=shown.map(item=>{
      const image=item.image?`<img class="table-thumb" src="${escapeHTML(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.opacity='.15'">`:`<span class="table-thumb-fallback">✿</span>`;
      const desc=item.description?`<span class="table-name-description">${escapeHTML(item.description)}</span>`:"";
      return `<tr class="database-row" tabindex="0" data-item-id="${escapeHTML(item.id)}">
        <td class="thumb-cell">${image}</td>
        <td class="name-cell"><strong>${escapeHTML(item.title)}</strong>${desc}</td>
        <td>${escapeHTML(item.category)}</td>
        <td>${escapeHTML(item.subcategory)}</td>
        ${columns.map(key=>`<td>${item.attributes&&item.attributes[key]!==undefined?escapeHTML(item.attributes[key]):"—"}</td>`).join("")}
      </tr>`;
    }).join("");
  }
  $("#resultCount").textContent=`${filteredItems.length.toLocaleString()} matching ${filteredItems.length===1?"entry":"entries"}`;
  $("#pageSummary").textContent=filteredItems.length?`Showing ${Math.min(visibleLimit,filteredItems.length).toLocaleString()} of ${filteredItems.length.toLocaleString()} entries`:"";
  $("#loadMore").hidden=visibleLimit>=filteredItems.length;
  $$(".database-row").forEach(row=>{
    const open=()=>showItem(row.dataset.itemId);
    row.addEventListener("click",open);
    row.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});
  });
}
function closeItemModal(){
  const modal = $("#itemModal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}
function showItem(id){
  const item=archive.find(entry=>entry.id===id);
  if(!item)return;
  const attrRows=Object.entries(item.attributes||{}).map(([key,value])=>`<div class="detail-row"><span>${escapeHTML(friendlyKey(key))}</span><strong>${escapeHTML(value)}</strong></div>`).join("");
  $("#modalContent").innerHTML=`<img class="modal-item-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" onerror="this.style.opacity='.2'"><div class="modal-copy"><p class="eyebrow">${escapeHTML(item.category)} · ${escapeHTML(item.subcategory)}</p><h2 id="modalTitle">${escapeHTML(item.title)}</h2><p>${escapeHTML(item.description||"No description was recorded.")}</p><div class="detail-list">${attrRows||"<p>No additional details were recorded.</p>"}</div></div>`;
  $("#itemModal").hidden=false;
  document.body.style.overflow="hidden";
  $("#modalClose").focus();
}
const spiritRows=[
["8:00 AM","South Hoof Peninsula","Forgotten Fields","Hollow Woods","Everwind Fields","Forgotten Fields","Golden Hills Valley","Everwind Fields"],
["9:00 AM","Sunfield farm","South Hoof Peninsula","Everwind fields","Dew's Farm, Epona","Valedale Lake","Seahorse Point","Everwind Fields"],
["10:00 AM","Stormgarden","Everwind Fields","","Everwind Fields","South Hoof Peninsula","Golden Hills Valley","Forgotten Fields"],
["11:00 AM","Everwind Fields","Silverglade Acres, near Marley","Dew's Farm, Epona","South Hoof Peninsula","Golden Hills Valley","Everwind Fields","Sunfield Farm"],
["12:00 PM","Hollow Woods","Golden Hills Valley","South Hoof Peninsula","Dew's Farm, Epona","Greendale","Firgrove","Valedale lake"],
["1:00 PM","Cauldron, Epona","Sunfield farm","Hollow Woods","South Hoof Peninsula","Fort Pinta","Golden Fields","South Hoof Peninsula"],
["2:00 PM","Forgotten Fields","Forgotten Fields","Firgrove","Firgrove","Seahorse Point","Goldspur","Everwind Fields"],
["3:00 PM","Everwind Fields","Goldspur","Firgrove","Firgrove","Sunfield farm","South Hoof Peninsula","Golden Hills Valley"],
["4:00 PM","Seahorse Point","South Hoof Peninsula","Firgrove","Forgotten Fields","Moorland","Firgrove","Golden Fields"],
["5:00 PM","Greendale","Seahorse Point","South Hoof Peninsula","Moorland","South Hoof","Moorland","Fort Pinta"],
["6:00 PM","Valedale Lake","Fort Pinta","Seahorse Point","Moorland","Golden Hills Valley","Nilmer's Highland","South Hoof Peninsula"],
["7:00 PM","Seahorse Point","Nilmer's Highland","Fort Pinta","Fort Pinta","Dew's farm, Epona","Stormgarden","Forgotten Fields"],
["8:00 PM","Everwind Fields","Moorland","Nilmer's Highland","Dew's Farm, Epona","Fort Pinta","Silverglade Acres, near Marley","Dew's Farm, Epona"],
["9:00 PM","Nilmer's Highland","Everwind Fields","New Hillcrest","Dew's Farm, Epona","Riding Hall","Moorland","Moorland"]
];
const locationNotes=[
["SH","lighthouse, middle, or close epona"],
["FG","close lake, andy, or at the hill where is that excavator close that tosunn's red cottage."],
["EF","Close North Link, close Hollow woods."],
["QF","Both sides of Barney, other one close the tractor, other close ML boarder behind the big sign."],
["FF","Closer riding hall, about middle of the map e closer that big tree that we helped with Lisa."],
["FP","Beach close Doyle's abbey, another place where he's going around that big hill pretty close Dew's (Epona). On the field area closer the swamp or closer the lighthouse going around the farm."],
["ML","Between Conrad and champ, or beach."],
["GHV","Close Pi, behind the Northern gate or close the wolves, moving in forest too."],
["HW","Close abandoned summer house or close Valedale Village."]
];
function renderSpirit(){
  const tableBody = $("#spiritTableBody");
  const notesHost = $("#locationNotes");
  if (tableBody) tableBody.innerHTML=spiritRows.map(row=>`<tr><th scope="row">${escapeHTML(row[0])}</th>${row.slice(1).map(value=>`<td>${escapeHTML(value)}</td>`).join("")}</tr>`).join("");
  if (notesHost) notesHost.innerHTML=locationNotes.map(([code,note])=>`<div class="location-note"><b>${escapeHTML(code)}:</b><span>${escapeHTML(note)}</span></div>`).join("");
}
function wireUp(){
  configureLinks();
  $("#menuToggle").addEventListener("click",()=>{
    const open=$("#mainNav").classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded",String(open));
  });
  $$("[data-page]").forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();
    setPage(link.dataset.page);
  }));
  $$('a[href^="#"]').filter(link=>!link.dataset.page).forEach(link=>link.addEventListener("click",event=>{
    const page=link.getAttribute("href").slice(1);
    if(pages.includes(page)){event.preventDefault();setPage(page);}
  }));
  const initial=location.hash.slice(1);
  setPage(pages.includes(initial)?initial:"home",false);
  $("#databaseSearch").addEventListener("input",event=>{
    searchTerm=event.target.value;
    $("#clearSearch").hidden=!searchTerm;
    applyFilters();
  });
  $("#clearSearch").addEventListener("click",()=>{
    $("#databaseSearch").value="";searchTerm="";$("#clearSearch").hidden=true;applyFilters();$("#databaseSearch").focus();
  });
  $("#sortSelect").addEventListener("change",applyFilters);
  $$(".category-button").forEach(button=>button.addEventListener("click",()=>{
    activeCategory=button.dataset.category;activeSubcategory="All";
    $$(".category-button").forEach(b=>b.classList.toggle("active",b===button));
    applyFilters();
  }));
  $("#loadMore").addEventListener("click",()=>{visibleLimit+=48;renderTable();});
  $("#modalClose")?.addEventListener("click",closeItemModal);
  $("#itemModal")?.addEventListener("click",event=>{if(event.target===$("#itemModal"))closeItemModal();});
  $("#showReference")?.addEventListener("click",()=>{const modal=$("#referenceModal");if(modal){modal.hidden=false;document.body.style.overflow="hidden";}});
  $("#referenceClose")?.addEventListener("click",()=>{const modal=$("#referenceModal");if(modal)modal.hidden=true;document.body.style.overflow="";});
  $("#referenceModal")?.addEventListener("click",event=>{if(event.target===$("#referenceModal")){ $("#referenceModal").hidden=true;document.body.style.overflow="";}});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"){closeItemModal();const referenceModal=$("#referenceModal");if(referenceModal)referenceModal.hidden=true;document.body.style.overflow="";}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setPage("database");$("#databaseSearch").focus();}
  });
  renderSpirit();
  loadArchive();
}
wireUp();
// Keep a matching horizontal scrollbar above the database table for easy access.
(function addDatabaseTopScrollbar(){
  function attach(){
    document.querySelectorAll('.database-table-shell').forEach(shell=>{
      if(shell.previousElementSibling?.classList.contains('database-top-scroll')) return;
      const bar=document.createElement('div'); bar.className='database-top-scroll'; bar.setAttribute('aria-label','Scroll database columns horizontally'); bar.tabIndex=0;
      const inner=document.createElement('div'); inner.className='database-top-scroll-inner'; bar.appendChild(inner);
      shell.parentNode.insertBefore(bar,shell);
      const table=shell.querySelector('.database-table');
      function size(){inner.style.width=Math.max(shell.scrollWidth,table?.scrollWidth||0)+'px';bar.scrollLeft=shell.scrollLeft;}
      bar.addEventListener('scroll',()=>{if(shell.scrollLeft!==bar.scrollLeft)shell.scrollLeft=bar.scrollLeft;});
      shell.addEventListener('scroll',()=>{if(bar.scrollLeft!==shell.scrollLeft)bar.scrollLeft=shell.scrollLeft;});
      if(window.ResizeObserver){const ro=new ResizeObserver(size);ro.observe(shell);if(table)ro.observe(table);}
      size();
    });
  }
  attach();
  if(window.MutationObserver)new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',attach);
})();
