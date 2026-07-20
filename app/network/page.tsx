import type { Metadata } from "next";
import NetworkGraph from "@/components/NetworkGraph";
import { buildNetwork, getMeetings, getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "발언 네트워크" };

export default function NetworkPage() {
  const speakers = getSpeakers();
  const network = buildNetwork();
  const meetingCount = getMeetings().length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">🕸️ 발언 네트워크 (전체 누적)</h1>
        <p className="mt-1 text-sm text-slate-600">
          {meetingCount}개 회의에서 집계한 지시·답변 관계입니다. 노드 크기는 발언량, 노드를
          클릭하면 발언자 페이지로 이동합니다.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-red-600" style={{ height: 3 }} /> 지시
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-navy-500" /> 답변·보고
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-slate-400" /> 같은 안건 언급
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <NetworkGraph nodes={network.nodes} edges={network.edges} speakers={speakers} />
      </div>
    </div>
  );
}
