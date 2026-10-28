// MODULE 4 · Owner: Person B
// POST { complaintId, stage: "first"|"escalation"|"rti", lang } -> { subject, body, sendTo }

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";
import { DEMO_COMPLAINTS } from "@/lib/demo";

export async function POST(req: Request) {
  const { complaintId, stage = "first", lang = "hi" } = await req.json();
  const complaint = DEMO_COMPLAINTS.find((c) => c.id === complaintId) ?? DEMO_COMPLAINTS[0];
  const days = Math.floor((Date.now() - new Date(complaint.createdAt).getTime()) / 86_400_000);

  const kind =
    stage === "rti"
      ? `an application under the Right to Information Act, 2005 asking for: the action-taken
         report on this complaint, the name and designation of the officer responsible, the
         sanctioned budget for this ward's road repair this year, and the file movement dates.
         Include the Rs 10 fee line and the First Appellate Authority line.`
      : stage === "escalation"
        ? `a formal escalation letter to the next higher authority, citing ${days} days of
           inaction, referencing the original complaint number, and asking for a dated
           commitment to act.`
        : `a formal first complaint letter to the responsible department.`;

  const prompt = `Write ${kind}

Complaint details: ${JSON.stringify(complaint)}

Write it in ${lang}, in the register an Indian government office expects. Be firm and
polite, never threatening. Keep it under 200 words.
Return JSON: { "subject": string, "body": string, "sendTo": string }`;

  const { data } = await callModel<{ subject: string; body: string; sendTo: string }>(
    { prompt, json: true },
    {
      subject: `${complaint.id} — ${days} दिन से लंबित शिकायत पर कार्रवाई हेतु`,
      sendTo: "Executive Engineer, PWD, Sitapur Division",
      body: `महोदय,

दिनांक ${new Date(complaint.createdAt).toLocaleDateString("en-IN")} को शिकायत संख्या ${complaint.id} दर्ज की गई थी, जिसमें ${complaint.ward} में ${complaint.description} की जानकारी दी गई थी।

आज ${days} दिन बीत चुके हैं। अब तक कोई कार्रवाई दर्ज नहीं हुई है, जबकि यह समस्या राहगीरों के लिए सीधा ख़तरा बनी हुई है।

निवेदन है कि इस शिकायत पर कार्रवाई कर, कार्य पूर्ण होने की तिथि लिखित में सूचित की जाए। अन्यथा सूचना का अधिकार अधिनियम, 2005 के अंतर्गत आवेदन प्रस्तुत किया जाएगा।

सादर,
शिकायतकर्ता
शिकायत संख्या: ${complaint.id}`,
    },
  );

  return NextResponse.json(data);
}
