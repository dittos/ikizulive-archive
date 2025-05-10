import type { Config } from "@react-router/dev/config";
import { loadAllData } from "./app/data";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,

  async prerender() {
    const paths = ["/"];
    const data = await loadAllData();
    const dates = data.postsByDate.map((date) => date.date);
    for (const lang of ["ko"]) {
      paths.push(`/${lang}`);
      for (const date of dates) {
        paths.push(`/${lang}/d/${date}`);
      }
    }
    return paths;
  },
} satisfies Config;
