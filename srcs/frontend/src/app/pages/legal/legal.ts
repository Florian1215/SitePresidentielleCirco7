import { Component } from '@angular/core';
import { CAMPAIGN } from '../../core/campaign.config';

@Component({
  selector: 'app-legal',
  template: `
    <section class="section">
      <div class="container container-narrow prose">
        <span class="eyebrow">Informations légales</span>
        <h1 class="h2">Mentions légales & données personnelles</h1>

        <h2>Éditeur</h2>
        <p>
          Ce site est édité par l'équipe de campagne de La France insoumise de la {{ c.circo }}.
          <em>[À compléter : nom de la ou du responsable de la publication, adresse, hébergeur.]</em>
        </p>

        <h2>Données personnelles</h2>
        <p>
          Les informations recueillies via les formulaires « Besoin d'un coup de main ? » (aide à l'inscription sur les listes) et « Contact »
          sont enregistrées par l'équipe de campagne, sur la base de votre consentement, dans le seul but de vous
          recontacter dans le cadre de l'élection présidentielle 2027 (rappels électoraux, aide à l'inscription,
          participation à la campagne, réponse à vos messages).
        </p>
        <p>
          Elles ne sont ni vendues ni cédées à des tiers et sont conservées au plus tard jusqu'à la fin de la campagne
          présidentielle 2027. Ces données peuvent révéler une opinion politique : elles bénéficient à ce titre d'une
          protection renforcée au sens du RGPD.
        </p>
        <p>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition.
          Pour l'exercer, écrivez à <a [href]="'mailto:' + c.contactEmail">{{ c.contactEmail }}</a>.
          Vous pouvez également introduire une réclamation auprès de la CNIL.
        </p>

        <h2>Cookies</h2>
        <p>
          Ce site n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Seul un jeton de connexion est
          conservé dans votre navigateur si vous vous connectez à l'espace rédaction.
        </p>
      </div>
    </section>
  `,
})
export class Legal {
  protected c = CAMPAIGN;
}
