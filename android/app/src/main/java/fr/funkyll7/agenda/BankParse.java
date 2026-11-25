package fr.funkyll7.agenda;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Lecture d'une notification bancaire : montant payé, solde éventuel, commerçant. Java pur (testable hors Android). */
final class BankParse {
    static final class R {
        boolean ok; double amt; Double bal; String label; String why;
    }

    private static final String NUM = "(\\d{1,3}(?:[ \\u00a0\\u202f.]\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:[ \\u00a0\\u202f,]\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
    private static final Pattern MONEY = Pattern.compile(
            "([-−+]?)\\s?(?:€|EUR)\\s?([-−+]?)" + NUM + "|([-−+]?)" + NUM + "\\s?(?:€|EUR|euros?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MERCHANT = Pattern.compile(
            "(?:\\bchez|\\bat|\\bà|\\baupr[eè]s de|\\bpour)\\s+([^,.;:·•\\n()€]{2,40}?)(?=\\s*(?:[,.;:·•\\n(]|$| le | du | a | avec | pour | sur |\\d))", Pattern.CASE_INSENSITIVE);

    private static final String[] INCOME = {"recu", "received", "rembours", "refund", "virement entrant", "credite", "credited", "added", "ajoute", "recharg", "top up", "top-up", "topped", "salaire", "incoming", "a ete verse", "vous a envoye", "sent you", "money in"};
    private static final String[] SKIP = {"refus", "declin", "echec", "failed", "investi", "invested", "arrondi", "round", "code", "connexion", "login", "secur", "authentif", "valider", "confirm", "gagn", "offre", "parrain", "cashback", "bonus", "promo", "win ", "plafond", "limite", "abonnement revolut", "frais de", "fee"};

    static String norm(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replace('’', '\'');
    }

    static double num(String s) {
        s = s.replaceAll("[ \\u00a0\\u202f]", "");
        int c = s.lastIndexOf(','), d = s.lastIndexOf('.');
        if (c >= 0 && d >= 0) {
            if (c > d) s = s.replace(".", "").replace(',', '.'); else s = s.replace(",", "");
        } else if (c >= 0) {
            s = s.length() - c - 1 == 3 && s.indexOf(',') == c && c > 0 && s.length() > 5 ? s.replace(",", "") : s.replace(',', '.');
        } else if (d >= 0) {
            if (s.length() - d - 1 == 3) s = s.replace(".", "");
        }
        return Double.parseDouble(s);
    }

    private static final class M { double v; boolean neg; int start, end; }

    static R parse(String title, String text) {
        R r = new R();
        String full = (title == null ? "" : title) + "\n" + (text == null ? "" : text);
        String n = norm(full);
        for (String k : SKIP) if (n.contains(k)) { r.why = "ignorée (" + k.trim() + ")"; return r; }
        for (String k : INCOME) if (n.contains(k)) { r.why = "ignorée (argent reçu)"; return r; }

        List<M> ms = new ArrayList<>();
        Matcher m = MONEY.matcher(full);
        while (m.find()) {
            M x = new M();
            String sign, val;
            if (m.group(3) != null) { sign = m.group(1) + m.group(2); val = m.group(3); }
            else { sign = m.group(4); val = m.group(5); }
            try { x.v = num(val); } catch (Exception e) { continue; }
            x.neg = sign != null && (sign.contains("-") || sign.contains("−"));
            x.start = m.start();
            x.end = m.end();
            ms.add(x);
        }
        if (ms.isEmpty()) { r.why = "ignorée (pas de montant)"; return r; }

        M spend = null;
        for (M x : ms) {
            String before = norm(full.substring(Math.max(0, x.start - 28), x.start));
            boolean isBal = before.contains("solde") || before.contains("balance") || before.contains("disponible") || before.contains("reste");
            if (isBal) { if (r.bal == null) r.bal = x.neg ? -x.v : x.v; }
            else if (spend == null) spend = x;
        }
        if (spend == null || spend.v <= 0) { r.why = "ignorée (seulement un solde)"; return r; }
        if (spend.v > 5000) { r.why = "ignorée (montant inhabituel)"; return r; }
        r.amt = Math.round(spend.v * 100) / 100.0;

        Matcher mm = MERCHANT.matcher(text == null ? "" : text);
        String label = null;
        if (mm.find()) label = mm.group(1).trim();
        if (label == null) {
            Matcher mt = MERCHANT.matcher(title == null ? "" : title);
            if (mt.find()) label = mt.group(1).trim();
        }
        if (label == null) {
            // « -23,40 € AUCHAN SUPERMARCHE » : le commerçant juste après le montant
            String after = full.substring(spend.end).split("[\\n.,;:·•(]")[0].trim();
            if (after.matches("[\\p{L}][\\p{L}0-9 '&*-]{1,39}") && !norm(after).matches("(le|du|sur|avec|depense|depenses|spent|paye|payes)( .*)?")) label = after;
        }
        if (label == null && title != null) {
            String t = title.trim();
            String nt = norm(t);
            if (!t.isEmpty() && !MONEY.matcher(t).find() && !nt.contains("revolut") && !nt.contains("caisse") && !nt.contains("paiement") && !nt.contains("payment") && !nt.contains("achat") && t.length() <= 40) label = t;
        }
        if (label != null) {
            label = label.replaceAll("^[^\\p{L}\\p{N}]+", "").trim();
            if (label.isEmpty()) label = null;
        }
        r.label = label;
        r.ok = true;
        r.why = "ajoutée";
        return r;
    }
}
