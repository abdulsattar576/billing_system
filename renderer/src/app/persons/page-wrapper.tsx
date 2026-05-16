import dynamic from "next/dynamic";

const PersonsPage = dynamic(() => import("./page"), {
  ssr: false, // ⛔ disable server-side rendering
});

export default PersonsPage;
