"use client";

import type { ReactNode } from "react";
import { CardView } from "./Cards";
import type { Card } from "@/lib/game/types";

const c = (kind: Card["kind"], value?: number): Card => ({ id: `r-${kind}-${value ?? 0}`, kind, value });

function Panel({ title, children, arrow, className = "" }: { title?: string; children: ReactNode; arrow?: boolean; className?: string }) {
  return (
    <section className={`panel ${arrow ? "panel-arrow" : ""} p-5 text-[13.5px] leading-relaxed ${className}`}>
      {title && <h2 className="mb-3 text-lg">{title}</h2>}
      {children}
    </section>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-4 !text-[14px] !normal-case !text-ink font-extrabold first:mt-0">{children}</h3>;
}

function WithCards({ cards, children }: { cards: Card[]; children: ReactNode }) {
  return (
    <div className="my-3 flex gap-3">
      <div className="flex shrink-0 flex-col gap-1.5">
        {cards.map((k) => (
          <CardView key={k.id} card={k} size="sm" />
        ))}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function RulesContent() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div className="flex flex-col gap-6">
        <Panel title="Компоненты игры" arrow>
          <p className="font-semibold">Колода включает:</p>
          <ul className="ml-4 mt-1 list-disc space-y-0.5">
            <li>32 карты этажей со значениями от 1 до 8, по 4 экземпляра каждой</li>
            <li>4 карты-джокера с вопросительным знаком</li>
            <li>Особые карты: 4 собаки, 2 кости, 3 молотка, 1 шар-баба, 4 молочных коктейля, 1 фургон с пончиками, 3 вора, 1 супер-вор</li>
          </ul>
        </Panel>
        <Panel title="Цель игры">
          Каждый игрок строит свою высотку. Каждый этаж состоит из <b>2 карт</b> с суммой <b>9</b>, выложенных рядом. Побеждает игрок,
          первым построивший высотку из <b>5 этажей</b>.
        </Panel>
        <Panel title="Подготовка">
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Каждому игроку раздаётся 5 карт.</li>
            <li>Из оставшихся карт формируется колода.</li>
            <li>Рядом с колодой — место для стопки сброса.</li>
            <li>Первый игрок выбирается случайно.</li>
          </ol>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel title="Ход игры" arrow>
          <p>Игроки ходят по очереди по часовой стрелке.</p>
          <H>1. Начало хода</H>
          <p>Игрок берёт карту из колоды. Если у него уже 8 карт в руке — карту не берёт.</p>
          <H>2. Розыгрыш карт</H>
          <p>Можно сыграть любое количество карт в любом порядке. Можно и вовсе ничего не разыгрывать.</p>
          <H>3. Конец хода</H>
          <p>
            Если в руке осталось меньше 3 карт — добирает до 3. Если колода пуста, стопка сброса перемешивается в новую колоду.
          </p>
          <p className="mt-2 rounded-lg bg-white/25 px-3 py-2 text-[12.5px]">
            <b>Онлайн-правило:</b> если в руке 8 карт и больше, можно сбросить лишнюю карту, чтобы игра не зашла в тупик.
          </p>
        </Panel>
        <Panel title="Победа">
          Как только игрок завершает <b>пятый этаж</b> — он ПОБЕДИТЕЛЬ!
          <p className="mt-2">
            <b>Короткий вариант:</b> побеждает игрок, построивший 4 этажа.
          </p>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel title="Возможные действия" arrow>
          <H>1. Строительство этажей</H>
          <div className="my-2 flex items-center gap-2">
            <CardView card={c("floor", 6)} size="sm" />
            <span className="font-display text-white">+</span>
            <CardView card={c("floor", 3)} size="sm" />
            <span className="font-display text-sm text-white">= 9 — один этаж</span>
          </div>
          <p>Разыграйте две карты с суммой 9. Новый этаж строится над уже построенным.</p>
          <H>2. Кража этажей</H>
          <p>
            Разыграйте одну карту и украдите карту с <b>верхнего этажа</b> соперника — вместе они должны дать 9. Вторая карта
            соперника сбрасывается, его этаж уничтожен. Нельзя красть с этажа под охраной собаки.
          </p>
          <H>3. Джокеры</H>
          <WithCards cards={[c("joker")]}>
            Джокер принимает любое значение и строится с любой обычной картой этажа (но не с другим джокером). Джокером нельзя украсть
            карту. Украденный джокер сохраняет своё значение.
          </WithCards>
        </Panel>
        <Panel title="Охрана и разрушение">
          <WithCards cards={[c("dog"), c("bone")]}>
            <b>Собака</b> охраняет ваш этаж: его нельзя украсть или разрушить молотком. <b>Кость</b> отвлекает собаку — обе карты
            уходят в сброс.
          </WithCards>
          <WithCards cards={[c("hammer"), c("wrecking")]}>
            <b>Молоток</b> и <b>Шар-баба</b> разрушают верхний этаж соперника. Молоток бессилен против собаки, а шар-баба сносит даже
            охраняемый этаж.
          </WithCards>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel title="Кража и пропуск хода">
          <WithCards cards={[c("thief"), c("superthief")]}>
            <b>Вор</b> крадёт случайную карту из руки выбранного соперника. <b>Супер-вор</b> — по одной карте у КАЖДОГО соперника.
            Украденные карты можно сыграть сразу или оставить.
          </WithCards>
          <WithCards cards={[c("milkshake"), c("van")]}>
            <b>Молочный коктейль</b> — соперник пропускает следующий ход и не берёт карту. <b>Фургон с пончиками</b> — ВСЕ соперники
            пропускают ход: доиграйте свой ход и сразу сделайте ещё один.
          </WithCards>
        </Panel>
        <section className="rounded-[14px] bg-cream p-5 text-[13.5px] leading-relaxed text-ink shadow-xl">
          <h2 className="mb-2 text-lg font-extrabold uppercase">Подсказки по стратегии</h2>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>Отвлеките собаку костью, а затем разрушьте этаж молотком — откроется этаж ниже. Украдите с него карту и постройте свой этаж!</li>
            <li>Используйте вора в начале хода — так будет больше вариантов для розыгрыша украденной карты.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

export function GameInfoBadges() {
  return (
    <div className="flex items-end justify-center gap-6 text-ink sm:gap-8">
      {[
        ["🎂", "6-99"],
        ["👥", "2-4"],
        ["⏱️", "20 мин."],
      ].map(([i, t]) => (
        <div key={t} className="flex flex-col items-center gap-1">
          <span className="text-3xl grayscale brightness-[3]">{i}</span>
          <span className="text-sm font-extrabold text-white">{t}</span>
        </div>
      ))}
    </div>
  );
}
