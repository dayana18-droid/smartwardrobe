// Имя базы IndexedDB и её версия.
const DB_NAME='virtual-wardrobe-db',DB_VERSION=1;
let db,clothes=[],looks=[],plans=[],usage={},filter='Все',editingId=null,newPhoto=null,selectedItems=new Set(),calDate=new Date(),pickedDate=new Date();

// Стартовые вещи. Их фотографии — простые локальные иллюстрации, которые можно заменить своими.
const demo=[['Льняная рубашка','Верх','👔','Бежевый','Весна'],['Пиджак свободного кроя','Верх','🧥','Зелёный','Осень'],['Джинсы прямые','Низ','👖','Голубой','На любой сезон'],['Кожаные лоферы','Обувь','👞','Коричневый','Демисезон'],['Мягкий джемпер','Верх','🧶','Розовый','Зима'],['Сумка на каждый день','Аксессуары','👜','Бежевый','На любой сезон'],['Юбка миди','Низ','👗','Чёрный','Весна'],['Белые кеды','Обувь','👟','Белый','На любой сезон']];

// IndexedDB: локальная база вещей, образов, планов и статистики.
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);
req.onupgradeneeded=()=>{const d=req.result;
for(const s of ['clothes','looks','plans','usage'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})};
req.onsuccess=()=>resolve(req.result);
req.onerror=()=>reject(req.error)})}
function all(store){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();
r.onsuccess=()=>resolve(r.result);
r.onerror=()=>reject(r.error)})}
function put(store,value){return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');
t.objectStore(store).put(value);
t.oncomplete=resolve;
t.onerror=()=>reject(t.error)})}
function del(store,id){return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');
t.objectStore(store).delete(id);
t.oncomplete=resolve;
t.onerror=()=>reject(t.error)})}
async function refresh(){[clothes,looks,plans]=await Promise.all([all('clothes'),all('looks'),all('plans')]);
const us=await all('usage');
usage=Object.fromEntries(us.map(x=>[x.id,x.count]));
renderAll()}
// Создаём автономные SVG-изображения для примеров — интернет не требуется.
function demoPhoto(emoji,color) {
  const backgrounds = {'Бежевый':'#eee9df','Зелёный':'#e5e8df','Голубой':'#e5eaeb','Розовый':'#eee4df','Чёрный':'#eae6ec','Белый':'#ecebe6','Коричневый':'#eee5dc'};
  const background = backgrounds[color] || '#eee9df';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="${background}"/><circle cx="150" cy="132" r="86" fill="#ffffff" opacity=".34"/><text x="150" y="168" text-anchor="middle" font-size="112">${emoji}</text><text x="150" y="258" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="3" fill="#77766f">SMART WARDROBE</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// При первом запуске добавляем примеры. Все следующие изменения идут в IndexedDB.
async function init() {
  try {
    db = await openDB();
    const existing = await all('clothes');

    // При самом первом запуске наполняем каталог демонстрационными вещами.
    if (existing.length === 0) {
      for (let i = 0; i < demo.length; i++) {
        const [name, category, emoji, color, season] = demo[i];
        await put('clothes', {
          id: 'demo-' + i, name, category, emoji, color, season,
          photo: demoPhoto(emoji, color), favorite: false,
          demo: true, created: Date.now() - i
        });
      }
    } else {
      // Добавляем картинки старым демонстрационным вещам после обновления сайта.
      for (const item of existing) {
        if (item.demo && !item.photo) {
          item.photo = demoPhoto(item.emoji, item.color);
          await put('clothes', item);
        }
      }
    }

    await refresh();
  } catch (error) {
    document.body.innerHTML = '<p style="padding:30px">Браузер не поддерживает IndexedDB. Открой сайт в актуальном Chrome, Safari или Firefox.</p>';
    return;
  }

  setup();
}
function esc(s='') {
  const entities = {
    '&': '&amp' + String.fromCharCode(59),
    '<': '&lt' + String.fromCharCode(59),
    '>': '&gt' + String.fromCharCode(59),
    '"': '&quot' + String.fromCharCode(59),
    "'": '&#39' + String.fromCharCode(59)
  };
  return String(s).replace(/[&<>"']/g, character => entities[character]);
}
function toast(s){const e=document.getElementById('toast');e.textContent=s;e.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>e.classList.remove('show'),2200)}
function word(n){let x=n%10,y=n%100;return x===1&&y!==11?'вещь':x>=2&&x<=4&&(y<12||y>14)?'вещи':'вещей'}
function colorClass(c){return ({'Зелёный':'sage','Голубой':'sky','Розовый':'rose','Серый':'lilac'})[c]||''}
// Отрисовка карточки одной вещи в каталоге.
function clothingCard(item){const used=usage[item.id]||0;return `<article class="item" data-id="${esc(item.id)}"><div class="photo ${colorClass(item.color)}">${item.photo?`<img src="${item.photo}" alt="${esc(item.name)}">`:`<span class="emoji">${esc(item.emoji||'👕')}</span>`}<div class="item-top"><button class="mini ${item.favorite?'favorite':''}" data-action="favorite" data-id="${esc(item.id)}" title="Избранное">${item.favorite?'♥':'♡'}</button><button class="mini" data-action="menu" data-id="${esc(item.id)}" title="Действия">···</button></div></div><div class="item-info"><div style="min-width:0"><div class="item-name">${esc(item.name)}</div><div class="item-sub">${esc(item.category)} · ${esc(item.color)}${used?` · надевали ${used}×`:''}</div></div></div></article>`}
// Отрисовка сохранённого образа и его действий.
function outfitCard(look){const parts=(look.items||[]).map(id=>clothes.find(c=>c.id===id)).filter(Boolean);const shown=parts.slice(0,3);return `<article class="look-card"><div class="look-photo">${shown.length?shown.map(c=>c.photo?`<img class="look-piece" style="object-fit:cover" src="${c.photo}" alt="${esc(c.name)}">`:`<div class="look-piece">${esc(c.emoji||'👕')}</div>`).join(''):'<span>Образ без вещей</span>'}<button class="mini ${look.favorite?'favorite':''}" data-action="lookfav" data-id="${esc(look.id)}" aria-label="Избранное">${look.favorite?'♥':'♡'}</button></div><div class="look-details"><div><b>${esc(look.name)}</b><small>${parts.map(p=>esc(p.name)).join(' · ')||'Вещи удалены'} · ${parts.length} ${word(parts.length)}</small></div><span class="tag">${look.random?'случайное сочетание':'твой образ'}</span></div><div class="look-actions"><button class="text-btn" data-action="schedule" data-id="${esc(look.id)}">＋ В календарь</button><button class="text-btn" style="color:#a37265" data-action="lookdelete" data-id="${esc(look.id)}">Удалить</button></div></article>`}
// Рисуем данные на главной странице и в остальных разделах.
function renderHome(){document.getElementById('homeStats').innerHTML=`<div class="stat"><div><span>В гардеробе</span><strong>${clothes.length}</strong></div><i class="stat-icon">▤</i></div><div class="stat"><div><span>Сохранено образов</span><strong>${looks.length}</strong></div><i class="stat-icon">✳</i></div><div class="stat"><div><span>Запланировано</span><strong>${plans.length}</strong></div><i class="stat-icon">▦</i></div>`;document.getElementById('homeItems').innerHTML=clothes.slice().sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,4).map(clothingCard).join('')||empty('Пока нет вещей','Добавь одежду в свой виртуальный гардероб');document.getElementById('homeLooks').innerHTML=looks.slice(0,3).map(outfitCard).join('')||empty('Образов пока нет','Собери первое сочетание из своих вещей')}
function empty(title,desc){return `<div class="empty"><b>${title}</b>${desc}</div>`}
function renderCloset(){const q=document.getElementById('search').value.trim().toLowerCase();const list=clothes.filter(c=>(filter==='Все'||(filter==='Избранное'?c.favorite:c.category===filter))&&(!q||c.name.toLowerCase().includes(q)||c.color.toLowerCase().includes(q)));document.getElementById('closetCaption').textContent=`${clothes.length} ${word(clothes.length)} в твоём гардеробе`;document.getElementById('closetGrid').innerHTML=list.map(clothingCard).join('')||empty(clothes.length?'Ничего не найдено':'Гардероб пока пуст',clothes.length?'Измени фильтр или запрос.':'Добавь вещь с помощью кнопки выше.')}
function renderLooks(){document.getElementById('looksGrid').innerHTML=looks.map(outfitCard).join('')||empty('Сохранённых образов пока нет','Собери образ вручную или попробуй случайное сочетание')}
// Строим календарь месяца и показываем планы выбранного дня.
function renderCalendar(){const y=calDate.getFullYear(),m=calDate.getMonth();document.getElementById('monthLabel').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(calDate);const first=(new Date(y,m,1).getDay()+6)%7,last=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),cells=[];for(let i=0;i<42;i++){let n,mm=m,yy=y,muted=false;if(i<first){n=prev-first+i+1;mm=m-1;muted=true}else if(i>=first+last){n=i-first-last+1;mm=m+1;muted=true}else n=i-first+1;const key=`${yy}-${String(mm+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`,today=new Date().toISOString().slice(0,10),selected=key===pickedDate.toISOString().slice(0,10),has=plans.some(p=>p.date===key);cells.push(`<button class="day ${muted?'muted':''} ${key===today?'today':''} ${selected?'selected':''} ${has?'has-plan':''}" data-date="${key}">${n}</button>`)}document.getElementById('calendarDays').innerHTML=cells.join('');document.getElementById('selectedDateLabel').textContent=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(pickedDate);const key=pickedDate.toISOString().slice(0,10),todayPlans=plans.filter(p=>p.date===key);document.getElementById('planList').innerHTML=todayPlans.map(p=>`<div class="plan-row"><span>✳ ${esc(p.name)}</span><button data-action="unplan" data-id="${esc(p.id)}" aria-label="Удалить план">×</button></div>`).join('')||'<div class="plan-empty">На этот день пока ничего не запланировано. Выбери образ из сохранённых.</div>';document.getElementById('planDate').value=key}
function renderStats(){const used=Object.entries(usage).sort((a,b)=>b[1]-a[1]).slice(0,8);document.getElementById('statsCards').innerHTML=`<div class="stat"><div><span>Всего вещей</span><strong>${clothes.length}</strong></div><i class="stat-icon">▤</i></div><div class="stat"><div><span>Сохранено образов</span><strong>${looks.length}</strong></div><i class="stat-icon">✳</i></div><div class="stat"><div><span>Всего использований</span><strong>${Object.values(usage).reduce((a,b)=>a+b,0)}</strong></div><i class="stat-icon">◷</i></div>`;document.getElementById('usageList').innerHTML=used.length?used.map(([id,n])=>{const c=clothes.find(x=>x.id===id);if(!c)return '';return `<div class="usage-row"><div class="usage-img">${c.photo?`<img src="${c.photo}" alt="">`:esc(c.emoji||'👕')}</div><div><b>${esc(c.name)}</b><small>${esc(c.category)} · использовали ${n} ${word(n)}</small></div><div class="bar"><i style="width:${Math.max(6,Math.min(100,n/Math.max(...used.map(x=>x[1]))*100))}%"></i></div></div>`}).join(''):empty('Статистика появится здесь','Собирай образы, чтобы видеть, какие вещи носишь чаще')}
function renderAll(){renderHome();renderCloset();renderLooks();renderCalendar();renderStats()}
function goto(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));const titles={home:'Добро пожаловать, <em>Алина</em>',closet:'Мой гардероб',outfits:'Твои образы',calendar:'Календарь образов',stats:'Твоя статистика'};document.getElementById('pageTitle').innerHTML=titles[name];if(name==='calendar')renderCalendar()}
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
// Подключаем обработчики всех кнопок и форм после загрузки данных.
function setup(){document.getElementById('dateLabel').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>goto(b.dataset.view));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));document.getElementById('addTop').onclick=document.getElementById('addCloset').onclick=()=>newItem();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));document.querySelectorAll('.modal-bg').forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-bg.open').forEach(m=>closeModal(m.id))});document.getElementById('categoryFilters').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;filter=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x===b));renderCloset()};document.getElementById('search').oninput=renderCloset;bindPhoto();document.getElementById('saveItem').onclick=saveItem;document.getElementById('buildLook').onclick=()=>openBuilder(false);document.getElementById('randomLook').onclick=randomOutfit;document.getElementById('saveLook').onclick=saveLook;document.getElementById('prevMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};document.getElementById('nextMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};document.getElementById('calendarDays').onclick=e=>{const b=e.target.closest('[data-date]');if(!b)return;pickedDate=new Date(b.dataset.date+'T12:00:00');renderCalendar()};document.getElementById('planButton').onclick=()=>{if(!looks.length)return toast('Сначала сохрани образ в конструкторе');document.getElementById('planLook').innerHTML=looks.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');document.getElementById('planDate').value=pickedDate.toISOString().slice(0,10);openModal('planModal')};document.getElementById('savePlan').onclick=savePlan;document.body.addEventListener('click',handleActions)}
function compress(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.8))};img.onerror=reject;img.src=url})}
function newItem(item=null){editingId=item?.id||null;newPhoto=item?.photo||null;document.getElementById('itemModalTitle').textContent=item?'Редактировать вещь':'Добавить вещь';document.getElementById('nameInput').value=item?.name||'';document.getElementById('categoryInput').value=item?.category||'Верх';document.getElementById('colorInput').value=item?.color||'Бежевый';document.getElementById('seasonInput').value=item?.season||'Демисезон';document.getElementById('uploadBox').innerHTML=item?.photo?`<img src="${item.photo}" alt="Предпросмотр фото"><input id="photoInput" type="file" accept="image/*" hidden>`:`<span><strong>＋ Добавь фото вещи</strong><span>Нажми, чтобы выбрать изображение</span></span><input id="photoInput" type="file" accept="image/*" hidden>`;bindPhoto();openModal('itemModal')}
function bindPhoto(){document.getElementById('photoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith('image/'))return toast('Выбери файл изображения');try{newPhoto=await compress(f);document.getElementById('uploadBox').innerHTML=`<img src="${newPhoto}" alt="Предпросмотр фото"><input id="photoInput" type="file" accept="image/*" hidden>`;bindPhoto()}catch{toast('Не удалось загрузить изображение')}}}
// Проверяем форму и сохраняем вещь в локальную базу.
async function saveItem(){const name=document.getElementById('nameInput').value.trim();if(!name)return toast('Введи название вещи');if(!newPhoto&&!editingId)return toast('Добавь фотографию вещи');const old=clothes.find(c=>c.id===editingId),item={...(old||{}),id:editingId||'item-'+crypto.randomUUID(),name,category:document.getElementById('categoryInput').value,color:document.getElementById('colorInput').value,season:document.getElementById('seasonInput').value,photo:newPhoto,emoji:old?.emoji||'👕',favorite:old?.favorite||false,created:old?.created||Date.now()};await put('clothes',item);await refresh();closeModal('itemModal');toast(old?'Изменения сохранены':'Вещь добавлена в гардероб')}
// Конструктор: отмечаем вещи, которые войдут в новый образ.
function openBuilder(preselected){selectedItems=new Set(preselected||[]);document.getElementById('builderList').innerHTML=['Верх','Низ','Обувь','Аксессуары'].map(cat=>`<div class="modal-section">${cat}</div><div class="builder-grid">${clothes.filter(c=>c.category===cat).map(c=>`<button class="pick ${selectedItems.has(c.id)?'chosen':''}" data-pick="${esc(c.id)}">${c.photo?`<img src="${c.photo}" alt="">`:`<span class="pick-emoji">${esc(c.emoji||'👕')}</span>`}<small>${esc(c.name)}</small></button>`).join('')||'<span style="font-size:10px;color:#999">Нет вещей в категории</span>'}</div>`).join('');document.getElementById('builderList').onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;selectedItems.has(b.dataset.pick)?selectedItems.delete(b.dataset.pick):selectedItems.add(b.dataset.pick);b.classList.toggle('chosen')};openModal('builderModal')}
async function saveLook(){const ids=[...selectedItems];if(!ids.length)return toast('Выбери хотя бы одну вещь');const cats=new Set(ids.map(id=>clothes.find(c=>c.id===id)?.category));if(cats.size<2)return toast('Для образа выбери вещи минимум из двух категорий');const name=document.getElementById('lookName').value.trim()||'Мой образ';const look={id:'look-'+crypto.randomUUID(),name,items:ids,favorite:false,random:false,created:Date.now()};await put('looks',look);for(const id of ids){usage[id]=(usage[id]||0)+1;await put('usage',{id,count:usage[id]})}await refresh();closeModal('builderModal');document.getElementById('lookName').value='';goto('outfits');toast('Образ сохранён')}
// Случайно выбираем по одной вещи из верха, низа и обуви.
async function randomOutfit(){const groups=['Верх','Низ','Обувь'].map(cat=>clothes.filter(c=>c.category===cat));if(groups.some(g=>!g.length))return toast('Добавь хотя бы верх, низ и обувь');const chosen=groups.map(g=>g[Math.floor(Math.random()*g.length)]),look={id:'look-'+crypto.randomUUID(),name:'Случайное сочетание',items:chosen.map(c=>c.id),favorite:false,random:true,created:Date.now()};await put('looks',look);await refresh();toast('Случайное сочетание собрано и сохранено')}
async function savePlan(){const look=looks.find(l=>l.id===document.getElementById('planLook').value),date=document.getElementById('planDate').value;if(!look||!date)return toast('Выбери образ и дату');await put('plans',{id:'plan-'+crypto.randomUUID(),lookId:look.id,name:look.name,date});pickedDate=new Date(date+'T12:00:00');await refresh();closeModal('planModal');toast('Образ добавлен в календарь')}
async function handleActions(e){const b=e.target.closest('[data-action]');if(!b)return;const id=b.dataset.id;switch(b.dataset.action){case'favorite':{const c=clothes.find(x=>x.id===id);if(c){c.favorite=!c.favorite;await put('clothes',c);await refresh()}break}case'menu':{const c=clothes.find(x=>x.id===id);if(!c)return;const choice=prompt(`Вещь: ${c.name}\nВведите 1 — изменить, 2 — удалить`);if(choice==='1')newItem(c);if(choice==='2'&&confirm('Удалить эту вещь?')){await del('clothes',id);for(const l of looks)if(l.items.includes(id)){l.items=l.items.filter(x=>x!==id);await put('looks',l)}await refresh();toast('Вещь удалена')}break}case'lookfav':{const l=looks.find(x=>x.id===id);l.favorite=!l.favorite;await put('looks',l);await refresh();break}case'lookdelete':if(confirm('Удалить этот образ?')){await del('looks',id);for(const p of plans.filter(x=>x.lookId===id))await del('plans',p.id);await refresh();toast('Образ удалён')}break;case'schedule':{const l=looks.find(x=>x.id===id);document.getElementById('planLook').innerHTML=`<option value="${esc(l.id)}">${esc(l.name)}</option>`;document.getElementById('planDate').value=pickedDate.toISOString().slice(0,10);openModal('planModal');break}case'unplan':await del('plans',id);await refresh();break}}
init();
