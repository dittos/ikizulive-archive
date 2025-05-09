import { type RouteConfig, index, prefix } from "@react-router/dev/routes";

export default [
  index("routes/redirect.tsx"),
  ...prefix(":lang", [
    index("routes/home.tsx"),
  ]),
] satisfies RouteConfig;
