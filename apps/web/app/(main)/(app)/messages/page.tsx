import { Suspense } from "react";
import { Inbox } from "@/features/message/components/inbox";

export default function MessagesPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
