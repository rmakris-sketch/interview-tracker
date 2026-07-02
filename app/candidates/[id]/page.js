"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useIdentity } from "@/context/IdentityContext";

const STATUS_OPTIONS = [
  "Under Review",
  "Advancing",
  "Not Advancing",
  "Offer Extended",
  "Hired",
];

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { name } = useIdentity();

  const [candidate, setCandidate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [myResponses, setMyResponses] = useState({}); // question_id -> { response_text, rating }
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [candidateForm, setCandidateForm] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: candidateData }, { data: questionData }, { data: responseData }] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", id).single(),
      supabase.from("questions").select("*").order("sort_order", { ascending: true }),
      supabase.from("responses").select("*").eq("candidate_id", id).eq("author_name", name),
    ]);
    setCandidate(candidateData || null);
    setCandidateForm(candidateData || null);
    setQuestions(questionData || []);
    const map = {};
    (responseData || []).forEach((r) => {
      map[r.question_id] = { response_text: r.response_text || "", rating: r.rating || "" };
    });
    setMyResponses(map);
    setLoading(false);
  }, [id, name]);

  useEffect(() => {
    if (name) loadAll();
  }, [loadAll, name]);

  async function saveResponse(questionId) {
    setSavingId(questionId);
    const entry = myResponses[questionId] || { response_text: "", rating: "" };
    await supabase.from("responses").upsert(
      {
        candidate_id: id,
        question_id: questionId,
        author_name: name,
        response_text: entry.response_text,
        rating: entry.rating === "" ? null : Number(entry.rating),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id,question_id,author_name" }
    );
    setSavingId(null);
  }

  async function saveCandidateInfo(e) {
    e.preventDefault();
    const { name: cName, position, interview_date, panel, final_status } = candidateForm;
    await supabase
      .from("candidates")
      .update({
        name: cName,
        position,
        interview_date: interview_date || null,
        panel,
        final_status,
      })
      .eq("id", id);
    setEditingCandidate(false);
    loadAll();
  }

  async function deleteCandidate() {
    if (!confirm("Delete this candidate and all notes about them? This cannot be undone.")) return;
    await supabase.from("candidates").delete().eq("id", id);
    router.push("/");
  }

  if (loading || !candidate) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <button className="text-sm text-gray-500 mb-4" onClick={() => router.push("/")}>
        ← Back to candidates
      </button>

      <div className="card mb-5">
        {editingCandidate ? (
          <form onSubmit={saveCandidateInfo} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Candidate name</label>
              <input
                className="input"
                value={candidateForm.name || ""}
                onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Position</label>
              <input
                className="input"
                value={candidateForm.position || ""}
                onChange={(e) => setCandidateForm({ ...candidateForm, position: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Interview date</label>
              <input
                type="date"
                className="input"
                value={candidateForm.interview_date || ""}
                onChange={(e) => setCandidateForm({ ...candidateForm, interview_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Panel / interviewers</label>
              <input
                className="input"
                value={candidateForm.panel || ""}
                onChange={(e) => setCandidateForm({ ...candidateForm, panel: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Final decision / status</label>
              <select
                className="input"
                value={candidateForm.final_status || "Under Review"}
                onChange={(e) => setCandidateForm({ ...candidateForm, final_status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingCandidate(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{candidate.name}</h1>
              <p className="text-sm text-gray-500">
                {candidate.position || "No position set"}
                {candidate.interview_date ? ` · ${candidate.interview_date}` : ""}
                {candidate.panel ? ` · Panel: ${candidate.panel}` : ""}
              </p>
              <p className="text-sm mt-1">
                Status: <span className="font-medium">{candidate.final_status || "Under Review"}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Shared with everyone</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setEditingCandidate(true)}>
                Edit
              </button>
              <button className="text-xs text-red-500" onClick={deleteCandidate}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Your private notes ({name})
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Only you can see what you write here. Other interviewers record their own notes separately.
      </p>

      {questions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No questions in the bank yet. Add some on the Question Bank page.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const entry = myResponses[q.id] || { response_text: "", rating: "" };
            return (
              <div key={q.id} className="card">
                <div className="text-sm font-medium mb-2">{q.text}</div>
                <textarea
                  className="input mb-2"
                  rows={3}
                  placeholder="Your notes on their answer..."
                  value={entry.response_text}
                  onChange={(e) =>
                    setMyResponses({
                      ...myResponses,
                      [q.id]: { ...entry, response_text: e.target.value },
                    })
                  }
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500">Rating</label>
                  <select
                    className="input w-24"
                    value={entry.rating}
                    onChange={(e) =>
                      setMyResponses({ ...myResponses, [q.id]: { ...entry, rating: e.target.value } })
                    }
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary ml-auto"
                    onClick={() => saveResponse(q.id)}
                    disabled={savingId === q.id}
                  >
                    {savingId === q.id ? "Saving..." : "Save note"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
