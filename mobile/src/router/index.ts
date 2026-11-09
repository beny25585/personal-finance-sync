import { createRouter, createWebHashHistory } from 'vue-router'
import OverviewView from '../views/OverviewView.vue'
import AccountsView from '../views/AccountsView.vue'
import TransactionsView from '../views/TransactionsView.vue'
import TransactionDetailView from '../views/TransactionDetailView.vue'
import SettingsView from '../views/SettingsView.vue'

// Hash routes work with the assets bundled in the Android app, without a server.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: OverviewView },
    { path: '/overview', redirect: '/dashboard' },
    { path: '/providers', component: AccountsView },
    { path: '/accounts', redirect: '/providers' },
    {
      path: '/transactions',
      component: TransactionsView,
      children: [
        { path: 'details', name: 'transaction-details', component: TransactionDetailView },
      ],
    },
    { path: '/settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
