'use strict';
const $=selector=>document.querySelector(selector);
function view(id){
  for(const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed',button.dataset.view===id);
  for(const panel of document.querySelectorAll('[data-panel]')) panel.hidden=panel.dataset.panel!==id;
}
for(const button of document.querySelectorAll('[data-view]')) button.onclick=()=>view(button.dataset.view);

$('#review').onsubmit=event=>{event.preventDefault();$('#published').textContent=$('#draft').value.trim();$('#state').textContent='Published';view('library');};
$('#notesForm').onsubmit=event=>{event.preventDefault();const field=event.currentTarget.elements.note;const note=field.value.trim();if(!note)return;const row=document.createElement('li');row.textContent=note;$('#notes').prepend(row);field.value='';};
view('library');
