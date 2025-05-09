import { Temporal } from "@js-temporal/polyfill";
import * as fs from "fs/promises";

export type Account = {
  id: string;
  name: string;
  username: string;
  profileImage: string;
}

export type Post = {
  id: string;
  created_at: string;
  text: string;
  user: {
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  };
}

export type AllData = {
  accounts: Account[];
  postsByDate: {
    date: string;
    posts: Post[];
  }[];
}

export async function loadAllData(): Promise<AllData> {
  const accounts: any[] = [
    {"x": "ikizulive_staff"},
    {"x": "polka_lion"},
    {"x": "hanabistarmine"},
    {"x": "G_Akky304250"},
    {"x": "My_Mai_Eld"},
    {"x": "Noricco_U"},
    {"x": "MiracleGoldSP"},
    {"x": "Rollie_twinkle"},
    {"x": "Yukuri_talk"},
  ];
  const allPosts = [];
  for (const account of accounts) {
    const files = await fs.readdir(`../data/posts/x/${account.x}`)
    const posts: Post[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await fs.readFile(`../data/posts/x/${account.x}/${file}`, "utf-8");
      const json = JSON.parse(data);
      posts.push({
        id: json.id,
        created_at: json.created_at,
        text: json.raw_data.legacy.full_text,
        user: json.raw_data.core.user_results.result.legacy,
      });
    }
    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestPost = posts[0];
    const user = latestPost.user;
    account.id = account.x;
    account.name = user.name;
    account.username = account.x;
    account.profileImage = user.profile_image_url_https;
    allPosts.push(...posts);
  }
  allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const postsByDate: { date: string; posts: Post[] }[] = [];
  allPosts.forEach((post) => {
    const dateStr = Temporal.Instant.from(post.created_at)
      .toZonedDateTimeISO("Asia/Tokyo")
      .toPlainDate()
      .toString();
    const existingDate = postsByDate.find((d) => d.date === dateStr);
    if (existingDate) {
      existingDate.posts.push(post);
    } else {
      postsByDate.push({ date: dateStr, posts: [post] });
    }
  });

  return {
    accounts,
    postsByDate,
  };
}
