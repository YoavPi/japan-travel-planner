import React from "react";
import LegalLayout, { H2, P, Ul, Li } from "../components/LegalLayout";

/* Credits & licenses — attribution required by the data/photo/font
   licenses the app relies on (OSM ODbL, CARTO, MapLibre, Google, Unsplash,
   SIL OFL). Reflects the app's ACTUAL sources. */
const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#E0533F", fontWeight: 700, textDecoration: "underline" }}>{children}</a>
);

const CreditsPage = () => (
  <LegalLayout title="קרדיטים ורישיונות" updated="24/08/2026">
    <P>מסלול נבנה בעזרת נתונים, ספריות ותכנים פתוחים. אנו מודים ליוצרים ומכבדים את רישיונותיהם.</P>

    <H2>מפות ונתוני מיפוי</H2>
    <Ul>
      <Li>נתוני המפה מגיעים מ-<A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A> (ברישיון ODbL).</Li>
      <Li>עיצוב ואריחי המפה מ-<A href="https://carto.com/attribution">CARTO</A> (Positron basemap).</Li>
      <Li>הצגת המפה באמצעות ספריית הקוד-הפתוח <A href="https://maplibre.org/">MapLibre GL JS</A> (רישיון BSD-3).</Li>
    </Ul>

    <H2>תמונות</H2>
    <Ul>
      <Li>תמונות מקומות ותצלומי רחוב מסופקים על-ידי <A href="https://developers.google.com/maps/documentation/places/web-service/policies">Google Places ו-Street View</A>, בכפוף לתנאי השימוש של Google.</Li>
      <Li>תמונות השראה בעמוד הבית מ-<A href="https://unsplash.com/license">Unsplash</A> (ברישיון Unsplash).</Li>
    </Ul>

    <H2>גופנים</H2>
    <Ul>
      <Li>הגופן <A href="https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew">Noto Sans Hebrew</A> (רישיון SIL Open Font License), דרך Google Fonts.</Li>
    </Ul>

    <H2>אנליטיקה ותשתית</H2>
    <Ul>
      <Li>אירוח ומדידת תנועה: <A href="https://vercel.com/">Vercel</A>.</Li>
      <Li>אנליטיקת מוצר: <A href="https://posthog.com/">PostHog</A> (בכפוף להסכמתך).</Li>
      <Li>מסד נתונים והתחברות: <A href="https://supabase.com/">Supabase</A>.</Li>
    </Ul>

    <P style={{ marginTop: 28, fontSize: 13.5, color: "#8A9198" }}>
      חסר קרדיט או נמצאה טעות? נשמח שתיידעו אותנו ונתקן.
    </P>
  </LegalLayout>
);

export default CreditsPage;
