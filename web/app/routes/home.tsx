import { useState } from "react"
import { Temporal, Intl } from "@js-temporal/polyfill"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Checkbox } from "~/components/ui/checkbox"
import type { AllData, Post, TranslatedPost } from "~/data"
import type { Route } from "./+types/home";
import { loadAllData, loadTranslatedPosts } from "~/data";
import { STRINGS, type Strings } from "~/i18n"
import { ChevronLeft, ChevronRight, SquareArrowOutUpRightIcon } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Link } from "react-router"

export async function loader({ params }: Route.LoaderArgs) {
  const strings = STRINGS[params.lang as keyof typeof STRINGS];
  if (!strings) {
    throw new Response("Not Found", { status: 404 });
  }
  const allData = await loadAllData();
  const offset = params.date ? allData.postsByDate.findIndex((date) => date.date === params.date) : 0;
  if (offset === -1) {
    throw new Response("Not Found", { status: 404 });
  }
  const postsByDate = allData.postsByDate.slice(offset, offset + 7);
  return {
    strings,
    accounts: allData.accounts,
    postsByDate,
    pages: {
      first: allData.postsByDate[0].date,
      prev: offset > 0 ? (allData.postsByDate[offset - 7] ?? allData.postsByDate[0])?.date : null,
      next: allData.postsByDate[offset + 7]?.date,
    },
    translatedPosts: await loadTranslatedPosts(params.lang, postsByDate.flatMap((date) => date.posts)),
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data.strings.home.title },
  ];
}

export default function Home({
  loaderData,
  params,
}: Route.ComponentProps) {
  const { accounts, postsByDate, strings, translatedPosts } = loaderData
  const [selectedAccounts, setSelectedAccounts] = useState(accounts.map((account) => account.username))

  // Filter tweets by selected accounts and group by date
  const filteredTweets = postsByDate
    .flatMap((date) => date.posts)
    .filter((tweet) => selectedAccounts.includes(tweet.user.screen_name))

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      setSelectedAccounts(selectedAccounts.filter((id) => id !== accountId))
    } else {
      setSelectedAccounts([...selectedAccounts, accountId])
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">
        <Link to={`/${params.lang}`}>
          {strings.home.title}
        </Link>
      </h1>

      {/* Account filter section */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">{strings.home.accountFilter}</h2>
        <div className="flex flex-wrap gap-y-3 gap-x-6">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center space-x-2">
              <Checkbox
                id={`account-${account.id}`}
                checked={selectedAccounts.includes(account.id)}
                onCheckedChange={() => toggleAccount(account.id)}
              />
              <label
                htmlFor={`account-${account.id}`}
                className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={account.profileImage || "/placeholder.svg"} alt={account.name} />
                  <AvatarFallback>{account.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                {account.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Posts
        strings={strings}
        lang={params.lang}
        accounts={accounts}
        posts={filteredTweets}
        translatedPosts={translatedPosts}
        pages={loaderData.pages}
      />
    </div>
  )
}

function Posts({
  lang,
  accounts,
  posts,
  translatedPosts,
  strings,
  pages,
}: {
  lang: string;
  accounts: AllData["accounts"];
  posts: Post[];
  translatedPosts: { [id: string]: TranslatedPost };
  strings: Strings;
  pages: {
    first: string;
    prev: string | null;
    next: string | null;
  };
}) {
  // Group tweets by date (YYYY-MM-DD)
  const groupedTweets = posts.reduce((groups, post) => {
    const dateStr = Temporal.Instant.from(post.created_at)
      .toZonedDateTimeISO("Asia/Tokyo")
      .toPlainDate()
      .toString()

    if (!groups[dateStr]) {
      groups[dateStr] = []
    }

    groups[dateStr].push(post)
    return groups
  }, {} as Record<string, Post[]>)

  // Sort dates in descending order
  const sortedDates = Object.keys(groupedTweets).sort((a, b) => b.localeCompare(a))

  // Get unique accounts that tweeted on a specific date
  const getAccountsForDate = (dateStr: string) => {
    const uniqueAccounts = new Set()
    groupedTweets[dateStr].forEach((tweet) => {
      uniqueAccounts.add(tweet.user.screen_name)
    })
    return Array.from(uniqueAccounts).map((username) => accounts.find((account) => account.username === username)!)
  }

  // Format date for display
  const formatDateHeader = (dateStr: string) => {
    return new Intl.DateTimeFormat(lang, { dateStyle: "full" }).format(Temporal.PlainDate.from(dateStr))
  }

  const dateNav = (
    <div className="flex justify-between items-center mb-6">
      {pages.prev && (
        <Link to={pages.prev === pages.first ? `/${lang}` : `/${lang}/d/${pages.prev}`}>
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ChevronLeft className="h-4 w-4 mr-1" /> 이전 페이지
          </Button>
        </Link>
      )}
      <div />
      {pages.next && (
        <Link to={`/${lang}/d/${pages.next}`}>
          <Button variant="outline" size="sm" className="cursor-pointer">
            다음 페이지 <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {dateNav}

      {sortedDates.map((dateStr) => (
        <div key={dateStr} className="bg-white rounded-lg shadow overflow-hidden">
          {/* Date header with profile pictures */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold mr-4">{formatDateHeader(dateStr)}</h2>
              <div className="flex -space-x-2">
                {getAccountsForDate(dateStr).map((account, index) => (
                  <Avatar key={account.id} className="border-2 border-white h-8 w-8">
                    <AvatarImage src={account.profileImage || "/placeholder.svg"} alt={account.name} />
                    <AvatarFallback>{account.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>

          {/* Tweets for this date */}
          <div className="divide-y">
            {groupedTweets[dateStr]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((post) => {
                const translatedPost = translatedPosts[post.id]
                return (
                  <Post
                    key={post.id}
                    post={post}
                    translatedPost={translatedPost}
                    strings={strings}
                  />
                );
              })}
          </div>
        </div>
      ))}
      
      {dateNav}
    </div>
  );
}

function Post({
  post,
  translatedPost,
  strings,
}: {
  post: Post;
  translatedPost?: TranslatedPost;
  strings: Strings;
}) {
  const [showOriginal, setShowOriginal] = useState(false)

  return (
    <div className="p-4" id={post.id}>
      <div className="flex">
        <Avatar className="h-10 w-10 mr-3">
          <AvatarImage src={post.user.profile_image_url_https} alt={post.user.name} />
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center">
            <span className="font-semibold">{post.user.name}</span>
            <span className="text-gray-500 ml-2">@{post.user.screen_name}</span>
            <a href={`#${post.id}`} className="text-gray-500 ml-2 text-sm">
              {Temporal.Instant.from(post.created_at).toZonedDateTimeISO("Asia/Tokyo").toPlainTime().toLocaleString("ko-KR", { timeStyle: "short" })}
            </a>
            <span className="ml-auto" />
            <a href={`https://x.com/${post.user.screen_name}/status/${post.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 ml-2 text-sm">
              <SquareArrowOutUpRightIcon size={16} />
            </a>
          </div>
          <div className="flex mt-1 gap-x-6 max-md:flex-col max-md:gap-y-3">
            <p className="text-gray-800 whitespace-pre-wrap flex-1">
              {translatedPost?.translated_text ?? post.text}
            </p>
            {showOriginal && (
              <p className="text-gray-500 whitespace-pre-wrap flex-1">
                {post.text}
              </p>
            )}
          </div>
          {translatedPost && (
            <p className="mt-2 text-gray-500 text-sm md:float-right">
              <a href="#" onClick={(e) => {
                e.preventDefault()
                setShowOriginal(!showOriginal)
              }}>{showOriginal ? strings.home.hideOriginal : strings.home.showOriginal}</a> &middot; {strings.home.translatedBy}: {translatedPost.raw_data?.model}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
