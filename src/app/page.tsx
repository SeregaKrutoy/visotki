import Image from "next/image";
import { GameInfoBadges, RulesContent } from "@/components/Rules";
import { ModeSelect } from "@/components/ModeSelect";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-3 py-5 pb-safe sm:px-6 sm:py-8">
      <section className="grid items-stretch gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="order-1 panel flex flex-col gap-4 overflow-hidden p-5 sm:gap-6 sm:p-8 lg:order-1">
          <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-ink shadow">
            <span className="text-brick">Карточная</span> игра онлайн
          </div>
          <div className="hidden sm:block">
            <GameInfoBadges />
          </div>
          <h1 className="title-3d text-center text-5xl sm:text-7xl md:text-8xl">ВЫСОТКИ</h1>
          <p className="text-center text-[14px] font-semibold leading-relaxed sm:text-[15px]">
            Стройте свой небоскрёб из карт с суммой <b className="text-white">9</b>, крадите этажи соперников, спускайте на них
            сторожевых собак и шар-бабу. Первый, кто возведёт <b className="text-white">5 этажей</b>, — побеждает!
          </p>
          <div className="relative mt-auto hidden aspect-[16/9] overflow-hidden rounded-xl border-2 border-ink sm:block">
            <Image src="/images/hero.jpg" alt="Ночная высотка" fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 600px" />
          </div>
        </div>
        <div className="order-2 lg:order-2">
          <ModeSelect />
        </div>
      </section>

      <section id="rules" className="mt-10 sm:mt-14">
        <h2 className="title-3d mb-5 text-center text-3xl sm:text-4xl">ПРАВИЛА ИГРЫ</h2>
        <RulesContent />
      </section>

      <footer className="mt-12 pb-6 text-center text-xs text-white/50">
        Фанатская онлайн-версия по мотивам настольной игры «Высотки». Для 2–4 игроков.
      </footer>
    </main>
  );
}
