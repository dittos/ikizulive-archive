import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/redirect.tsx"),
  ...prefix(":lang", [
    route(":dir?/:date?", "routes/home.tsx"),
  ]),
] satisfies RouteConfig;
