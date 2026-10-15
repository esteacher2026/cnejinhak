/* ---------- udm 순수 함수 (DOM 없음, node:test 대상) ---------- */
const UDM = {
  tabFromHash(hash) { return hash === '#univDB-matrix' ? 'matrix' : 'search'; },
  indexByUnit(records) {
    const m = new Map();
    records.filter(r => !r.excluded).sort((a, b) => a.srcRow - b.srcRow)
      .forEach(r => { if (!m.has(r.unit)) m.set(r.unit, []); m.get(r.unit).push(r); });
    return m;
  },
  footerCounts(records, subjects, groups) {
    const marks = {}, grp = {};
    subjects.forEach(s => { marks[s.key] = 0; });
    groups.forEach(g => { grp[g.key] = 0; });
    records.forEach(r => {
      r.marks.forEach(k => { if (k in marks) marks[k]++; });
      const gs = r.allSubjects ? groups.map(g => g.key) : r.groups;
      gs.forEach(g => { if (g in grp) grp[g]++; });
    });
    return { marks, groups: grp };
  },
  evaluate(rec, mySubs, subjectsByGroup) {
    const missing = rec.marks.filter(k => !mySubs.has(k));
    // 전 교과 안내(allSubjects)는 교과군별이 아니라 "1과목 이상 체크"로 판정한다(스펙 3.3)
    const groupsMissing = rec.allSubjects ? [] : rec.groups.filter(g => !(subjectsByGroup[g] || []).some(k => mySubs.has(k)));
    const allMissing = !!rec.allSubjects && mySubs.size === 0;
    // 판정할 과목이 전혀 없는 행(기타 열만 안내)은 충족도 부족도 아닌 '판정 없음'(na)
    const na = !rec.marks.length && !rec.groups.length && !rec.allSubjects;
    return { ok: !na && !missing.length && !groupsMissing.length && !allMissing, na, missing, groupsMissing };
  },
  subjectCoverage(records, subjectKey, groupKey, includeGroups) {
    return records.filter(r => r.marks.includes(subjectKey) || (includeGroups && (r.allSubjects || r.groups.includes(groupKey))));
  },
  matchUnitRecords(file1, universityKey, keywords) {
    if (!universityKey) return [];
    const text = r => (r.unit_name || '') + ' ' + (r.unit_parent || '');
    return file1.filter(r => r.university_display === universityKey && keywords.some(k => text(r).includes(k)));
  },
  pickKeyword(hits, keywords) {
    const text = r => (r.unit_name || '') + ' ' + (r.unit_parent || '');
    let best = '', bestN = 0;
    keywords.forEach(k => { const n = hits.filter(r => text(r).includes(k)).length; if (n > bestN) { best = k; bestN = n; } });
    return best;
  }
};
