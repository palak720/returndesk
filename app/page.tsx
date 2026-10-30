import { Suspense } from "react";
import { RequestList } from "@/components/RequestList";

export default function Home() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <RequestList />
    </Suspense>
  );
}