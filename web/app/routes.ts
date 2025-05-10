import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/redirect.tsx"),
  ...prefix(":lang", [
    route("d?/:date?", "routes/home.tsx"),
  ]),
] satisfies RouteConfig;
