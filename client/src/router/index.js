import { createRouter, createWebHashHistory } from 'vue-router';
import TemplateEditor from '../views/TemplateEditor.vue';
import DealersView from '../views/DealersView.vue';
import RenderView from '../views/RenderView.vue';

const routes = [
  { path: '/', component: TemplateEditor },
  { path: '/dealers', component: DealersView },
  { path: '/render', component: RenderView }
];

export default createRouter({ history: createWebHashHistory(), routes });
