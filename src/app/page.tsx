import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-muted/30">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-3xl font-bold tracking-tight">
            CradleHub
          </CardTitle>
          <CardDescription className="text-base">
            Cradle Massage &amp; Wellness Spa
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/login">Staff Login</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/book">Book an Appointment</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
