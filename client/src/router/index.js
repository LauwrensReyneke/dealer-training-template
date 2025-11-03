import { createRouter, createWebHashHistory } from 'vue-router';
import TemplateEditor from '../views/TemplateEditor.vue';
import DealersView from '../views/DealersView.vue';
import RenderView from '../views/RenderView.vue';
import PricesView from '../views/PricesView.vue';

const routes = [
  { path: '/', component: TemplateEditor },
  { path: '/dealers', component: DealersView },
  { path: '/render', component: RenderView },
  { path: '/prices', component: PricesView }
];

export default createRouter({ history: createWebHashHistory(), routes });
