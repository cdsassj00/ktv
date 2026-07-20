import type { Metadata } from "next";
import NetworkView from "@/components/NetworkView";
import BackLink from "@/components/BackLink";
import { buildNetwork, getExchangeIndex, getMeetings, getSearchDocs, getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "발언 네트워크" };

export default function NetworkPage() {
  const speakers = getSpeakers();
  const network = buildNetwork();
  const meetingCount = getMeetings().length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <BackLink />
      <header>
        <p className="overline-label">Network</p>
        <h1 className="h-judge mt-1">
          발언 네트워크 <span className="text-navy-400">(전체 누적)</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
          {meetingCount}개 회의에서 집계한 지시·답변 관계입니다. 노드 크기는 발언량이며, 누가
          누구에게 지시하고 누가 답하는지를 입체적으로 보여줍니다.
        </p>
      </header>

      <NetworkView nodes={network.nodes} edges={network.edges} speakers={speakers} searchDocs={getSearchDocs()} exchangeIndex={getExchangeIndex()} />
    </div>
  );
}
