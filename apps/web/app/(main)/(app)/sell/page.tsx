import { Container } from "@/components/layout/Container";
import { SellFlow } from "@/features/listings/components/SellFlow";

export default function SellPage() {
  return (
    <Container className="py-6 sm:py-8">
      <SellFlow />
    </Container>
  );
}
