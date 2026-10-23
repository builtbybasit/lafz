import { createRouter, createWebHistory } from "vue-router";

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: () => import("../views/HomeView.vue") },
    { path: "/world/:level?", name: "world", component: () => import("../views/WorldView.vue") },
    { path: "/pack/:id", name: "pack", component: () => import("../views/PackView.vue") },
    { path: "/pack/:id/quiz", name: "quiz", component: () => import("../views/QuizView.vue") },
    { path: "/review", name: "review", component: () => import("../views/QuizView.vue") },
    { path: "/words", name: "words", component: () => import("../views/WordBookView.vue") },
    { path: "/:any(.*)", redirect: "/" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
