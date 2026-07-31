/* Wodouh — reminder export to Apple Calendar and Google Calendar.
 *
 * Deliberately has no dependencies and needs no backend, no OAuth and no
 * calendar permission prompt.
 *
 * Apple Calendar (and Outlook, and Fantastical, and the stock Android
 * calendar) all import RFC 5545 .ics files. We generate one and hand it to
 * the OS as a download; iOS and macOS then offer "Add All" into the user's
 * chosen calendar. That is the whole integration: no entitlement, no
 * EventKit permission, nothing to deny.
 *
 * Google Calendar has no bulk import URL, so a single event opens its
 * prefilled template page and multiple events fall back to the same .ics,
 * which Google Calendar imports via Settings → Import.
 *
 * Because we never ask for calendar access, there is no "permission denied"
 * state to handle. What can fail is the download itself (blocked popup,
 * sandboxed iframe), so every entry point reports success or failure back to
 * the caller rather than assuming.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------ encoding */

  /* RFC 5545 §3.3.11: backslash, semicolon, comma and newline are special. */
  function escText(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  /* UTC stamp: 20260731T131500Z */
  function stampUTC(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }

  /* All-day dates are local and date-only per RFC 5545 §3.6.1. */
  function stampDate(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  /* §3.1: lines are octet-limited to 75, continued with CRLF + one space.
     Arabic is multi-byte, so fold on encoded length, never on character
     count, and never split a multi-byte sequence. */
  function fold(line) {
    var out = "", cur = "", len = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      /* Keep surrogate pairs together. */
      if (ch >= "\uD800" && ch <= "\uDBFF" && i + 1 < line.length) ch += line[++i];
      var w = unescape(encodeURIComponent(ch)).length;
      if (len + w > 74) { out += cur + "\r\n "; cur = ""; len = 1; }
      cur += ch; len += w;
    }
    return out + cur;
  }

  function uid(seed) {
    return "wodouh-" + seed + "-" +
      Math.random().toString(36).slice(2, 10) + "@wodouh.app";
  }

  /* ------------------------------------------------------------- VEVENTs */

  /* ev: { title, description, start (Date|ms), end?, allDay?, alarmMinutes?,
           rrule?, url? } */
  function vevent(ev, i) {
    var start = ev.start instanceof Date ? ev.start : new Date(ev.start);
    if (isNaN(start.getTime())) return null;

    var lines = [
      "BEGIN:VEVENT",
      "UID:" + uid(i),
      "DTSTAMP:" + stampUTC(new Date())
    ];

    if (ev.allDay) {
      var endDay = ev.end ? new Date(ev.end) : new Date(start.getTime() + 86400000);
      lines.push("DTSTART;VALUE=DATE:" + stampDate(start));
      lines.push("DTEND;VALUE=DATE:" + stampDate(endDay));
    } else {
      var end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60000);
      lines.push("DTSTART:" + stampUTC(start));
      lines.push("DTEND:" + stampUTC(end));
    }

    lines.push("SUMMARY:" + escText(ev.title));
    if (ev.description) lines.push("DESCRIPTION:" + escText(ev.description));
    if (ev.url) lines.push("URL:" + escText(ev.url));
    if (ev.rrule) lines.push("RRULE:" + ev.rrule);

    /* A deadline the user cannot act on is worthless, so every event carries
       a notification. Default is one day ahead. */
    var mins = ev.alarmMinutes == null ? 1440 : Number(ev.alarmMinutes);
    if (mins >= 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:" + escText(ev.title),
        "TRIGGER:-PT" + Math.round(mins) + "M",
        "END:VALARM"
      );
    }

    lines.push("END:VEVENT");
    return lines;
  }

  function buildICS(events, calName) {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wodouh//Contract reminders//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];
    if (calName) {
      lines.push("X-WR-CALNAME:" + escText(calName));
    }
    var n = 0;
    (events || []).forEach(function (ev, i) {
      var block = vevent(ev, i);
      if (block) { lines = lines.concat(block); n++; }
    });
    lines.push("END:VCALENDAR");
    if (!n) return null;
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  /* -------------------------------------------------------------- output */

  function slug(s) {
    return String(s || "wodouh").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "wodouh";
  }

  /* Returns true on success. Callers surface a message on false rather than
     silently doing nothing. */
  function downloadICS(events, opts) {
    opts = opts || {};
    var ics = buildICS(events, opts.calendarName);
    if (!ics) return false;
    try {
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = slug(opts.filename || "wodouh-reminders") + ".ics";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      /* Revoking immediately can cancel the download in some browsers. */
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Google's template URL takes exactly one event. */
  function googleUrl(ev) {
    var start = ev.start instanceof Date ? ev.start : new Date(ev.start);
    if (isNaN(start.getTime())) return null;
    var end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60000);
    var dates = ev.allDay
      ? stampDate(start) + "/" + stampDate(new Date(start.getTime() + 86400000))
      : stampUTC(start) + "/" + stampUTC(end);

    var q = [
      "action=TEMPLATE",
      "text=" + encodeURIComponent(ev.title || ""),
      "dates=" + dates
    ];
    if (ev.description) q.push("details=" + encodeURIComponent(ev.description));
    if (ev.rrule) q.push("recur=" + encodeURIComponent("RRULE:" + ev.rrule));
    return "https://calendar.google.com/calendar/render?" + q.join("&");
  }

  /* One event opens Google directly; several fall back to .ics, which Google
     Calendar imports. Returns "google" | "ics" | false. */
  function addToGoogle(events, opts) {
    var list = events || [];
    if (list.length === 1) {
      var url = googleUrl(list[0]);
      if (url) {
        var w = global.open(url, "_blank", "noopener,noreferrer");
        if (w) return "google";
      }
    }
    return downloadICS(list, opts) ? "ics" : false;
  }

  global.WodouhCalendar = {
    buildICS: buildICS,
    downloadICS: downloadICS,
    googleUrl: googleUrl,
    addToGoogle: addToGoogle
  };
})(window);
