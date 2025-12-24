import React, { useEffect, useRef, useState } from "react"
import { Temporal, Intl } from "@js-temporal/polyfill"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Checkbox } from "~/components/ui/checkbox"
import type { Post, TranslatedPost } from "~/data"
import type { Route } from "./+types/home";
import { loadAllData, loadTranslatedPosts } from "~/data";
import { STRINGS } from "~/i18n"
import { ChevronLeft, ChevronRight, SquareArrowOutUpRightIcon, ChevronDown, ChevronUp, Calendar } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Link, useLoaderData, useParams } from "react-router"
import { DateCalendar } from "~/components/ui/date-calendar"

export async function loader({ params }: Route.LoaderArgs) {
  const strings = STRINGS[params.lang as keyof typeof STRINGS];
  if (!strings) {
    throw new Response("Not Found", { status: 404 });
  }
  const direction = params.dir ?? "until";
  if (direction !== "until" && direction !== "since") {
    throw new Response("Not Found", { status: 404 });
  }

  const allData = await loadAllData(direction === "until" ? "desc" : "asc");
  const oldest = allData.postsByDate[direction === "until" ? allData.postsByDate.length - 1 : 0].date;
  const offset = params.date ? allData.postsByDate.findIndex((date) => date.date === params.date) : 0;
  if (offset === -1) {
    throw new Response("Not Found", { status: 404 });
  }
  const postsByDate = allData.postsByDate.slice(offset, offset + 7);
  return {
    strings,
    accounts: allData.accounts,
    postsByDate,
    allDates: allData.postsByDate.map((d) => d.date),
    dateAccounts: Object.fromEntries(
      allData.postsByDate.map(({ date, posts }) => [
        date,
        Array.from(new Set(posts.map((p) => p.account.id))),
      ])
    ),
    pages: {
      direction: direction as "until" | "since",
      oldest,
      first: allData.postsByDate[0].date,
      prev: offset > 0 ? (allData.postsByDate[offset - 7] ?? allData.postsByDate[0])?.date : null,
      next: allData.postsByDate[offset + 7]?.date,
      current: postsByDate[0].date,
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
  const [selectedAccounts, setSelectedAccounts] = useState(accounts.map((account) => account.id).filter((id) => id !== "official"))

  // Filter tweets by selected accounts and group by date
  const filteredTweets = postsByDate
    .flatMap((date) => date.posts)
    .filter((tweet) => selectedAccounts.includes(tweet.account.id))

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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedAccounts.length === accounts.length}
              onCheckedChange={() => {
                if (selectedAccounts.length === accounts.length) {
                  setSelectedAccounts([])
                } else {
                  setSelectedAccounts(accounts.map((account) => account.id))
                }
              }}
            />
            <label
              htmlFor="select-all"
              className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {strings.home.selectAll}
            </label>
          </div>
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
                  <AvatarImage src={account.x.profile_image_url_https} alt={account.name[params.lang]} />
                  <AvatarFallback>{account.name[params.lang]}</AvatarFallback>
                </Avatar>
                {account.name[params.lang].split(" ").pop()}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Posts
        posts={filteredTweets}
        translatedPosts={translatedPosts}
        selectedAccounts={selectedAccounts}
      />

      {/* Footer */}
      <div className="text-center text-gray-500 mt-8 text-sm whitespace-pre-wrap">
        {strings.footer.disclaimer}
      </div>
    </div>
  )
}

function DateNav({
  lang,
  pages,
  strings,
  month,
  setMonth,
  datesWithPosts,
  toPath,
  placement = "below",
}: {
  lang: string
  pages: {
    direction: "until" | "since"
    oldest: string
    first: string
    prev: string | null
    next: string | null
    current: string
  }
  strings: any
  month: Temporal.PlainDate
  setMonth: React.Dispatch<React.SetStateAction<Temporal.PlainDate>>
  datesWithPosts: string[]
  toPath: (dateStr: string) => string
  placement?: "above" | "below"
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const popoverContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!calendarOpen) return
      const el = popoverContainerRef.current
      if (!el) return
      const anyEvt = e as any
      const path: EventTarget[] | undefined = typeof anyEvt.composedPath === "function" ? anyEvt.composedPath() : undefined
      const isInside = path ? path.includes(el) : (e.target instanceof Node && el.contains(e.target))
      if (!isInside) {
        setCalendarOpen(false)
      } else {
        e.stopPropagation()
      }
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [calendarOpen])

  return (
    <div className="flex items-center mb-6">
      <Link to={`/${lang}`}>
        <Button variant={pages.direction === "until" ? "default" : "outline"} size="sm" className="cursor-pointer">
          {strings.home.sortByLatest}
        </Button>
      </Link>
      <Link to={`/${lang}/since/${pages.oldest}`} className="ml-2">
        <Button variant={pages.direction === "since" ? "default" : "outline"} size="sm" className="cursor-pointer">
          {strings.home.sortByOldest}
        </Button>
      </Link>

      <div className="ml-auto" />

      {pages.prev && (
        <Link to={pages.prev === pages.first ? `/${lang}` : `/${lang}/${pages.direction}/${pages.prev}`}>
          <Button variant="outline" size="sm" className="cursor-pointer" aria-label={strings.home.prevPage}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{strings.home.prevPage}</span>
          </Button>
        </Link>
      )}
      {pages.next && (
        <Link to={`/${lang}/${pages.direction}/${pages.next}`} className="ml-2">
          <Button variant="outline" size="sm" className="cursor-pointer" aria-label={strings.home.nextPage}>
            <span className="hidden sm:inline">{strings.home.nextPage}</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      )}

      <div className="relative" ref={popoverContainerRef}>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 cursor-pointer"
          onClick={() => setCalendarOpen((v) => !v)}
          aria-expanded={calendarOpen}
          aria-haspopup="dialog"
          title={strings.home.goToDate}
          aria-label={strings.home.goToDate}
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">{strings.home.goToDate}</span>
          {calendarOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        <div
          className={`absolute right-0 z-50 ${
            placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
          } ${calendarOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}
          aria-hidden={!calendarOpen}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            ;(e.nativeEvent as any)?.stopImmediatePropagation?.()
          }}
        >
          <DateCalendar
            month={month}
            setMonth={setMonth}
            lang={lang}
            datesWithPosts={datesWithPosts}
            currentDateStr={pages.current}
            toPath={toPath}
            onNavigate={() => setCalendarOpen(false)}
          />
        </div>
      </div>
    </div>
  )
}

function Posts({
  posts,
  translatedPosts,
  selectedAccounts,
}: {
  posts: Post[];
  translatedPosts: { [id: string]: TranslatedPost };
  selectedAccounts: string[];
}) {
  const {lang} = useParams()
  const {accounts, strings, pages, allDates, dateAccounts} = useLoaderData<typeof loader>()
  const initialMonth = Temporal.PlainDate.from(pages.current).with({ day: 1 })
  const [month, setMonth] = useState(initialMonth)
  const datesWithPosts = new Set(
    allDates.filter((d) => {
      const accs = (dateAccounts as Record<string, string[]>)?.[d] ?? []
      return accs.some((id) => selectedAccounts.includes(id))
    })
  )

  // Keep calendar month in sync with the currently active date (route/page changes)
  useEffect(() => {
    const target = Temporal.PlainDate.from(pages.current).with({ day: 1 })
    setMonth(target)
  }, [pages.current])

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

  // Get unique accounts that tweeted on a specific date
  const getAccountsForDate = (dateStr: string) => {
    const uniqueAccounts = new Set()
    groupedTweets[dateStr].forEach((tweet) => {
      uniqueAccounts.add(tweet.account.id)
    })
    return Array.from(uniqueAccounts).map((id) => accounts.find((account) => account.id === id)!)
  }

  // Format date for display
  const formatDateHeader = (dateStr: string) => {
    return new Intl.DateTimeFormat(lang, { dateStyle: "full" }).format(Temporal.PlainDate.from(dateStr))
  }

  const toPath = (dateStr: string) => `/${lang}/${pages.direction}/${dateStr}`


  return (
    <div className="space-y-8">
      <DateNav
        lang={lang!}
        pages={pages}
        strings={strings}
        month={month}
        setMonth={setMonth}
        datesWithPosts={Array.from(datesWithPosts)}
        toPath={toPath}
      />

      {posts.length === 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden p-4 text-center text-gray-500">
          {strings.home.noPosts}
        </div>
      )}

      {Object.keys(groupedTweets).map((dateStr) => (
        <div key={dateStr} className="bg-white rounded-lg shadow overflow-hidden">
          {/* Date header with profile pictures */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold mr-4">{formatDateHeader(dateStr)}</h2>
              <div className="flex -space-x-2">
                {getAccountsForDate(dateStr).map((account, index) => (
                  <Avatar key={account.id} className="border-2 border-white h-8 w-8">
                    <AvatarImage src={account.x.profile_image_url_https} alt={account.x.name} />
                    <AvatarFallback>{account.x.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>

          {/* Tweets for this date */}
          <div className="divide-y">
            {groupedTweets[dateStr]
              .map((post) => {
                const translatedPost = translatedPosts[post.id]
                return (
                  <Post
                    key={post.id}
                    post={post}
                    translatedPost={translatedPost}
                  />
                );
              })}
          </div>
        </div>
      ))}
      
      <DateNav
        lang={lang!}
        pages={pages}
        strings={strings}
        month={month}
        setMonth={setMonth}
        datesWithPosts={Array.from(datesWithPosts)}
        toPath={toPath}
        placement="above"
      />
    </div>
  );
}

function Post({
  post,
  translatedPost,
}: {
  post: Post;
  translatedPost?: TranslatedPost;
}) {
  const [showOriginal, setShowOriginal] = useState(false)
  const {lang} = useParams()
  const {pages, strings} = useLoaderData<typeof loader>()

  return (
    <div className="p-4" id={post.id}>
      <div className="flex">
        <Avatar className="h-10 w-10 mr-3">
          <AvatarImage src={post.account.x.profile_image_url_https} alt={post.account.x.name} />
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center">
            <span className="font-semibold">{post.account.x.translated_name?.["base"] === post.account.x.name ? post.account.x.translated_name[lang!] : post.account.x.name}</span>
            <span className="text-gray-500 ml-2">@{post.account.x.screen_name}</span>
            <a href={`/${lang}/${pages.direction}/${pages.current}#${post.id}`} className="text-gray-500 ml-2 text-sm">
              {Temporal.Instant.from(post.created_at).toZonedDateTimeISO("Asia/Tokyo").toPlainTime().toLocaleString("ko-KR", { timeStyle: "short" })}
            </a>
            <span className="ml-auto" />
            <a href={`https://x.com/${post.account.x.screen_name}/status/${post.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 ml-2 text-sm">
              <SquareArrowOutUpRightIcon size={16} />
            </a>
          </div>
          <div className="flex mt-1 gap-x-6 max-md:flex-col max-md:gap-y-3">
            <p className="text-gray-800 whitespace-pre-wrap flex-1">
              {formatText(translatedPost?.translated_text ?? post.text, post)}
            </p>
            {showOriginal && (
              <p className="text-gray-500 whitespace-pre-wrap flex-1">
                {formatText(post.text, post)}
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

type RichTextNode = string | {
  node: React.ReactNode
  originalLength: number
}

class RichText {
  private nodes: RichTextNode[]

  constructor(text: string) {
    this.nodes = [text]
  }

  replaceRange(start: number, end: number, replacement: React.ReactNode) {
    const newNodes: RichTextNode[] = []

    let nodeStart = 0
    this.nodes.forEach((node) => {
      // can't split react node
      if (typeof node !== "string") {
        newNodes.push(node)
        nodeStart += node.originalLength
        return;
      }

      const nodeEnd = nodeStart + node.length;
      // if node contains the range, split
      if (nodeStart <= start && end <= nodeEnd) {
        if (nodeStart < start) {
          newNodes.push(node.substring(0, start - nodeStart))
        }
        newNodes.push({
          node: replacement,
          originalLength: end - start,
        })
        if (nodeEnd > end) {
          newNodes.push(node.substring(end - nodeStart))
        }
      } else {
        newNodes.push(node)
      }
      nodeStart = nodeEnd
    })

    this.nodes = newNodes
  }

  add(node: React.ReactNode) {
    this.nodes.push({
      node,
      originalLength: 0,
    })
  }

  getNodes() {
    return this.nodes.map((node) => typeof node === "string" ? node : node.node);
  }
}

function formatText(text: string, post: Post) {
  // Format the translated text with the original text and entities
  let formattedText = new RichText(text)

  // Replace URLs in the translated text with the original URLs
  if (post.entities?.urls) {
    post.entities.urls.forEach((url) => {
      const originalText = url.url
      let pos = 0
      while (pos < text.length) {
        const index = text.indexOf(originalText, pos)
        if (index === -1) break
        pos = index + originalText.length
        formattedText.replaceRange(index, index + originalText.length,
          <a href={url.expanded_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{url.display_url}</a>);
      }
    })
  }

  if (post.entities?.media) {
    post.entities.media.forEach((media) => {
      const originalText = media.url
      const replacement = (
        <a href={media.expanded_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 block my-3">
          <img src={media.media_url_https} alt={media.display_url} className="max-w-[80%] h-auto rounded-md" loading="lazy" />
        </a>
      );
      let pos = 0
      let found = false
      while (pos < text.length) {
        const index = text.indexOf(originalText, pos)
        if (index === -1) break
        pos = index + originalText.length
        found = true
        formattedText.replaceRange(index, index + originalText.length, replacement);
      }
      if (!found) {
        formattedText.add(replacement);
      }
    })
  }

  return formattedText.getNodes()
}
