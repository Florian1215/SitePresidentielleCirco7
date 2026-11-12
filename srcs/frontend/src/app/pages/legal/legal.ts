import { Component, inject } from '@angular/core';
import { I18n } from '../../core/i18n';
import { CAMPAIGN } from '../../core/campaign.config';

@Component({
  selector: 'app-legal',
  template: `
    @let t = i18n.d().legal;
    <section class="section">
      <div class="container container-narrow prose">
        <span class="eyebrow">{{ t.eyebrow }}</span>
        <h1 class="h2">{{ t.title }}</h1>

        <h2>{{ t.publisherTitle }}</h2>
        <p>
          {{ i18n.f(t.publisher, { circo: i18n.d().common.circo }) }}
          <em>{{ t.publisherTodo }}</em>
        </p>

        <h2>{{ t.dataTitle }}</h2>
        <p>{{ t.data1 }}</p>
        <p>{{ t.data2 }}</p>
        <p>
          {{ t.data3 }} <a [href]="'mailto:' + c.contactEmail">{{ c.contactEmail }}</a>.
          {{ t.data3b }}
        </p>

        <h2>{{ t.cookiesTitle }}</h2>
        <p>{{ t.cookies }}</p>
      </div>
    </section>
  `,
})
export class Legal {
  protected c = CAMPAIGN;
  protected i18n = inject(I18n);
}
