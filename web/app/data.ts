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
  entities?: {
    media?: {
      url: string;
      expanded_url: string;
      display_url: string;
      media_url_https: string;
    }[];
    urls?: {
      url: string;
      display_url: string;
      expanded_url: string;
    }[];
  };
  user: {
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  };
}

export type TranslatedPost = {
  id: string;
  translated_text: string;
  raw_data?: {
    model?: string;
  };
}

export type AllData = {
  accounts: Account[];
  postsByDate: {
    date: string;
    posts: Post[];
  }[];
}

async function loadAccounts() {
  const data = await fs.readFile("../data/accounts.json", "utf-8");
  return JSON.parse(data);
}

export async function loadAllData(direction: "asc" | "desc" = "desc"): Promise<AllData> {
  const accounts = await loadAccounts();
  const allPosts = [];
  for (const account of accounts) {
    const files = await fs.readdir(`../data/posts/x/${account.x}`)
    const posts: Post[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      if (file.replace(".json", "").includes(".")) continue; // translation
      const data = await fs.readFile(`../data/posts/x/${account.x}/${file}`, "utf-8");
      const json = JSON.parse(data);
      posts.push({
        id: json.id,
        created_at: json.created_at,
        text: json.raw_data.legacy.full_text,
        user: json.raw_data.core.user_results.result.legacy,
        entities: json.raw_data.legacy.entities,
      });
    }
    const latestPost = posts[0];
    const user = latestPost.user;
    account.id = account.x;
    account.name = user.name;
    account.username = account.x;
    account.profileImage = user.profile_image_url_https;
    allPosts.push(...posts);
  }
  allPosts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (direction === "desc") {
    allPosts.reverse();
  }

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

export async function loadTranslatedPosts(lang: string, posts: Post[]): Promise<{ [id: string]: TranslatedPost }> {
  const translations: { [id: string]: TranslatedPost } = {};
  for (const post of posts) {
    const file = `../data/posts/x/${post.user.screen_name}/${post.id}.${lang}.json`;
    let json;
    try {
      json = await fs.readFile(file, "utf-8");
    } catch (error) {
      continue;
    }
    const data = JSON.parse(json) as TranslatedPost;
    translations[data.id] = data;
  }
  return translations;
}
