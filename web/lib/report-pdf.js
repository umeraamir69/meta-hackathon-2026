'use client';

import { jsPDF } from 'jspdf';

const MARGIN = 48;
const PAGE_W = 612; // letter
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 56;

const INK = [22, 24, 20];
const MUTED = [90, 96, 84];
const FAINT = [130, 136, 122];
const LINE = [210, 214, 200];
const FAIL = [200, 60, 40];
const PASS = [70, 130, 60];
const ACCENT = [90, 110, 30];

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : 'unlabeled';
}

function safe(text) {
  return String(text || '')
    .replaceAll('\u2028', ' ')
    .replaceAll('\u2029', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function filenameFor(report) {
  const base = String(report?.source || 'scan').replaceAll(/[^\w.-]+/g, '_');
  return `sentinel-merge-gate-${base}.pdf`;
}

function createDoc() {
  return new jsPDF({ unit: 'pt', format: 'letter', compress: true });
}

function drawFooter(doc, page, total, generated) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text('PR Diff Sentinel · Merge gate report · Rules decide Pass/Fail · Muse explains · Secrets masked', MARGIN, PAGE_H - 26);
  doc.text(`Page ${page} of ${total} · ${generated}`, PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });
}

function ensureSpace(ctx, need) {
  if (ctx.y + need <= BOTTOM) return;
  ctx.doc.addPage();
  ctx.page += 1;
  ctx.y = MARGIN;
}

function hr(ctx, gap = 14) {
  ensureSpace(ctx, gap + 4);
  ctx.doc.setDrawColor(...LINE);
  ctx.doc.setLineWidth(0.7);
  ctx.doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
  ctx.y += gap;
}

function sectionTitle(ctx, num, title) {
  ensureSpace(ctx, 36);
  ctx.y += 6;
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...ACCENT);
  ctx.doc.text(num, MARGIN, ctx.y);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(14);
  ctx.doc.setTextColor(...INK);
  ctx.doc.text(title, MARGIN + 28, ctx.y);
  ctx.y += 10;
  hr(ctx, 16);
}

function bodyText(ctx, text, { size = 10, color = MUTED, bold = false, indent = 0, after = 8 } = {}) {
  const value = safe(text);
  if (!value) return;
  ctx.doc.setFont('helvetica', bold ? 'bold' : 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...color);
  const lines = ctx.doc.splitTextToSize(value, CONTENT_W - indent);
  for (const line of lines) {
    ensureSpace(ctx, size + 4);
    ctx.doc.text(line, MARGIN + indent, ctx.y);
    ctx.y += size + 3;
  }
  ctx.y += after;
}

function metaRow(ctx, label, value) {
  if (!value) return;
  ensureSpace(ctx, 16);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...FAINT);
  ctx.doc.text(String(label).toUpperCase(), MARGIN, ctx.y);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(...INK);
  const lines = ctx.doc.splitTextToSize(safe(value), CONTENT_W - 110);
  ctx.doc.text(lines[0] || '', MARGIN + 110, ctx.y);
  ctx.y += 14;
  for (let i = 1; i < lines.length; i += 1) {
    ensureSpace(ctx, 12);
    ctx.doc.text(lines[i], MARGIN + 110, ctx.y);
    ctx.y += 12;
  }
}

/**
 * Build and download a complete merge-gate PDF for a scan report.
 * @param {object} report
 * @param {{ url?: string, fromCache?: boolean, savedAt?: number|null }} [meta]
 */
export function downloadReportPdf(report, meta = {}) {
  if (!report) return;

  const doc = createDoc();
  const generated = meta.savedAt
    ? new Date(meta.savedAt).toLocaleString()
    : new Date().toLocaleString();
  const score = report.score || {};
  const blocking = (report.findings || []).filter((f) => !f.advisory);
  const advisory = (report.findings || []).filter((f) => f.advisory);
  const fixes = report.fixes || [];
  const rotate = report.muse?.rotate || [];
  const ignore = report.muse?.ignore || [];
  const gatePass = Boolean(report.ok);

  const ctx = { doc, y: MARGIN, page: 1 };

  // Masthead
  doc.setFillColor(24, 28, 20);
  doc.rect(0, 0, PAGE_W, 118, 'F');
  doc.setFillColor(212, 232, 80);
  doc.rect(0, 0, 8, 118, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(212, 232, 80);
  doc.text('PR DIFF SENTINEL', MARGIN, 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Merge Gate Report', MARGIN, 62);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(190, 198, 178);
  doc.text(safe(report.source || 'Unknown target'), MARGIN, 84);
  doc.text(
    meta.fromCache ? `Cached export · ${generated}` : `Live export · ${generated}`,
    MARGIN,
    100,
  );

  ctx.y = 146;

  // Gate + score band
  ensureSpace(ctx, 92);
  const bandY = ctx.y;
  doc.setDrawColor(...LINE);
  doc.setFillColor(gatePass ? 245 : 252, gatePass ? 250 : 244, gatePass ? 240 : 240);
  doc.roundedRect(MARGIN, bandY, CONTENT_W, 84, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text('MERGE GATE', MARGIN + 18, bandY + 22);
  doc.text('RISK SCORE', MARGIN + CONTENT_W * 0.58, bandY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...(gatePass ? PASS : FAIL));
  doc.text(gatePass ? 'PASS' : 'FAIL', MARGIN + 18, bandY + 54);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...(score.grade === 'A' ? PASS : FAIL));
  doc.text(String(score.value ?? 0), MARGIN + CONTENT_W * 0.58, bandY + 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    gatePass
      ? 'No blocking secrets. AI advisories never flip this gate.'
      : 'Blocking secrets found. Do not merge until rotated or removed.',
    MARGIN + 18,
    bandY + 72,
  );
  doc.text(
    `${score.grade || 'A'} · ${score.label || 'Clean'} · 0 clean → 100 critical`,
    MARGIN + CONTENT_W * 0.58,
    bandY + 72,
  );

  ctx.y = bandY + 104;

  // Metadata
  sectionTitle(ctx, '00', 'Report details');
  metaRow(ctx, 'Subject', report.source);
  metaRow(ctx, 'Repository', report.owner && report.repo
    ? `${report.owner}/${report.repo}${report.pull ? ` · PR #${report.pull}` : ''}`
    : null);
  metaRow(ctx, 'Scope', report.scope);
  metaRow(ctx, 'Source URL', meta.url || null);
  metaRow(ctx, 'Head', report.head || null);
  metaRow(ctx, 'Muse', report.muse
    ? `${report.muse.provider || 'local'}${report.muse.model ? ` · ${report.muse.model}` : ''}`
    : 'local rules only');
  metaRow(ctx, 'Blocking', String(score.blocking ?? report.count ?? blocking.length));
  metaRow(ctx, 'AI advisory', String(score.advisory ?? advisory.length));
  ctx.y += 4;

  // Summary
  sectionTitle(ctx, '01', 'Executive summary');
  if (score.headline) bodyText(ctx, score.headline, { size: 11, color: INK, bold: true, after: 10 });
  if (report.muse?.summary) {
    bodyText(ctx, 'Muse narrative', { size: 8, color: FAINT, bold: true, after: 2 });
    bodyText(ctx, report.muse.summary, { size: 10, after: 10 });
  }
  const stats = [
    `Blocking: ${score.blocking ?? blocking.length}`,
    `Likely live: ${score.live ?? 0}`,
    `Sample/fixture: ${score.examples ?? 0}`,
    `Deleted in tree: ${score.deleted ?? 0}`,
    `AI advisory: ${score.advisory ?? advisory.length}`,
  ].join('   ·   ');
  bodyText(ctx, stats, { size: 9, color: INK, after: 10 });

  if (score.factors?.length) {
    bodyText(ctx, 'Score factors', { size: 8, color: FAINT, bold: true, after: 4 });
    for (const factor of score.factors) {
      bodyText(
        ctx,
        `${factor.text} (${factor.weight > 0 ? `+${factor.weight}` : factor.weight})`,
        { size: 9, after: 2 },
      );
    }
    ctx.y += 6;
  }

  // Findings
  sectionTitle(ctx, '02', 'Findings');
  if (blocking.length === 0) {
    bodyText(
      ctx,
      advisory.length
        ? 'No blocking secrets. AI authorship signals are listed later and never fail the merge.'
        : 'Nothing in this scan blocks the merge.',
      { after: 8 },
    );
  } else {
    blocking.forEach((finding, index) => {
      ensureSpace(ctx, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(`${String(index + 1).padStart(2, '0')}  ${finding.rule || 'finding'}`, MARGIN, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...(finding.severity === 'critical' || finding.severity === 'high' ? FAIL : MUTED));
      doc.text(
        `${finding.severity || 'medium'} · ${pretty(finding.label)}`,
        PAGE_W - MARGIN,
        ctx.y,
        { align: 'right' },
      );
      ctx.y += 14;

      bodyText(
        ctx,
        [
          finding.source,
          finding.path ? `${finding.path}${finding.line ? `:${finding.line}` : ''}` : null,
          finding.removed ? 'removed' : null,
          finding.encoding ? `encoded ${finding.encoding}` : null,
        ].filter(Boolean).join(' · '),
        { size: 9, color: ACCENT, after: 2 },
      );
      if (finding.masked) bodyText(ctx, `Masked: ${finding.masked}`, { size: 9, after: 2 });
      if (finding.author || finding.date) {
        bodyText(ctx, [finding.author, finding.date].filter(Boolean).join(' · '), { size: 8, color: FAINT, after: 2 });
      }
      if (finding.why) bodyText(ctx, finding.why, { size: 9, after: 4 });
      if (finding.commit) bodyText(ctx, `Commit: ${finding.commit}`, { size: 8, color: FAINT, after: 2 });
      ctx.y += 6;
      hr(ctx, 12);
    });
  }

  // Fix plan
  sectionTitle(ctx, '03', 'Fix plan');
  const plan = fixes.length
    ? fixes
    : rotate.flatMap((item) => (item.steps || []).map((step) => ({
      where: item.where || item.rule,
      text: step,
      blast: item.blast,
      why: item.why_live,
    })));

  if (plan.length === 0) {
    bodyText(ctx, 'No rotate steps for this scan.', { after: 8 });
  } else {
    plan.forEach((item, index) => {
      ensureSpace(ctx, 48);
      bodyText(ctx, `${String(index + 1).padStart(2, '0')}  ${item.where || 'action'}`, {
        size: 10,
        color: INK,
        bold: true,
        after: 2,
      });
      bodyText(ctx, item.text, { size: 9, after: 2 });
      if (item.why) bodyText(ctx, item.why, { size: 8, color: FAINT, after: 2 });
      if (item.blast) bodyText(ctx, `Blast: ${item.blast}`, { size: 8, color: FAINT, after: 2 });
      ctx.y += 4;
    });
  }

  const patches = rotate.filter((item) => item.fix?.path).slice(0, 4);
  if (patches.length) {
    bodyText(ctx, 'Suggested patches', { size: 8, color: FAINT, bold: true, after: 4 });
    for (const item of patches) {
      bodyText(
        ctx,
        `--- a/${item.fix.path}\n+++ b/${item.fix.path}\n- ${item.fix.before || ''}\n+ ${item.fix.after || ''}`,
        { size: 8, color: MUTED, after: 8 },
      );
    }
  }

  // AI advisory
  if (advisory.length) {
    sectionTitle(ctx, '04', 'AI signals (advisory only)');
    bodyText(ctx, 'These never block the merge. Evidence for human review.', { after: 8 });
    if (report.muse?.assessment) {
      const a = report.muse.assessment;
      bodyText(
        ctx,
        `Assessment · ${pretty(a.verdict)}${a.confidence ? ` · ${a.confidence} confidence` : ''}`,
        { size: 10, color: INK, bold: true, after: 4 },
      );
      for (const note of (a.notes || []).slice(0, 6)) bodyText(ctx, note, { size: 9, after: 2 });
      for (const focus of (a.review_focus || []).slice(0, 6)) bodyText(ctx, `Check: ${focus}`, { size: 9, after: 2 });
      ctx.y += 4;
    }
    advisory.forEach((finding, index) => {
      bodyText(
        ctx,
        `${String(index + 1).padStart(2, '0')}  ${finding.rule} · ${pretty(finding.label)}`,
        { size: 10, color: INK, bold: true, after: 2 },
      );
      bodyText(
        ctx,
        `${finding.source} · ${finding.path || '—'}${finding.line ? `:${finding.line}` : ''}`,
        { size: 9, color: ACCENT, after: 2 },
      );
      if (finding.why) bodyText(ctx, finding.why, { size: 9, after: 6 });
    });
  }

  if (ignore.length) {
    sectionTitle(ctx, '05', '.sentinelignore candidates');
    for (const item of ignore.slice(0, 12)) {
      bodyText(ctx, item.pattern, { size: 9, color: ACCENT, bold: true, after: 2 });
      if (item.reason) bodyText(ctx, item.reason, { size: 8, color: FAINT, after: 6 });
    }
  }

  // Closing
  sectionTitle(ctx, '06', 'Attestation');
  bodyText(
    ctx,
    'This report was produced by PR Diff Sentinel. Secret-matching rules decide Pass or Fail. Muse may label findings and propose rotate steps, but cannot clear a Fail. Credential values in this document are masked.',
    { size: 9, after: 8 },
  );
  bodyText(
    ctx,
    meta.fromCache
      ? 'Exported from a scan saved in this browser.'
      : 'Exported from a live hosted scan.',
    { size: 8, color: FAINT, after: 0 },
  );

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, total, generated);
  }

  doc.save(filenameFor(report));
}
