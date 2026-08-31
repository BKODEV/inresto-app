import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

/** Ligne d'un rappel d'identification, affichée sous le texte d'une confirmation. */
export interface LigneRecap {
  label: string;
  valeur: string | number | null | undefined;
}

export interface OptionsConfirmation {
  titre: string;
  texte?: string;
  /** Rappel des informations d'identification de l'objet visé (voir `confirmer`). */
  recap?: LigneRecap[];
  /** Libellé du bouton de validation. Par défaut « Confirmer ». */
  confirmer?: string;
  /** Libellé du bouton d'abandon. Par défaut « Annuler ». */
  annuler?: string;
  /**
   * Action destructrice : bouton rouge et focus posé sur « Annuler », pour
   * qu'une validation au clavier n'efface rien par inadvertance.
   */
  danger?: boolean;
  icone?: SweetAlertIcon;
}

export interface OptionsSaisie {
  titre: string;
  texte?: string;
  label?: string;
  placeholder?: string;
  valeur?: string;
  multiligne?: boolean;
  /**
   * Refuse une saisie vide. Une chaîne remplace le message de refus par défaut.
   */
  obligatoire?: boolean | string;
  confirmer?: string;
  annuler?: string;
  danger?: boolean;
}

/** Durées d'affichage des notifications, en millisecondes. */
const DUREE_SUCCES = 3000;
const DUREE_INFO = 4000;
// Une erreur porte un message à lire — souvent une phrase renvoyée par l'API —,
// là où un succès ne fait que confirmer ce que l'utilisateur vient de faire.
const DUREE_ERREUR = 6000;

/**
 * Dialogues et notifications de l'application.
 *
 * Remplace `confirm()`, `alert()` et `prompt()` du navigateur : ceux-ci bloquent
 * le thread, ne se stylent pas, et sortent l'utilisateur de l'application le
 * temps d'un dialogue système. Tout passe désormais par SweetAlert2, habillé
 * avec les jetons du design system (`src/styles/_sweetalert.scss`) — les boutons
 * réutilisent d'ailleurs directement `.btn-primary`, `.btn-secondary` et
 * `.btn-danger`, via `buttonsStyling: false`.
 *
 * Deux registres :
 *  - les DIALOGUES (`confirmer`, `confirmerSuppression`, `saisir`, `message`)
 *    interrompent : ils attendent une décision ;
 *  - les NOTIFICATIONS (`succes`, `erreur`, `avertissement`, `info`) sont des
 *    bandeaux passagers en haut à droite, pour rendre compte sans interrompre.
 *
 * En rendu serveur, aucune de ces méthodes n'affiche quoi que ce soit : une
 * confirmation y répond « non » et une saisie `null`, ce qui laisse l'action
 * appelante sans effet plutôt que de la faire échouer.
 */
@Injectable({ providedIn: 'root' })
export class AlerteService {
  private readonly estNavigateur = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Réglages communs à tous les dialogues. `buttonsStyling: false` neutralise
   * les boutons de la bibliothèque au profit de ceux du design system, et
   * `reverseButtons` place la validation à droite, comme partout ailleurs dans
   * l'application.
   */
  private readonly baseDialogue: SweetAlertOptions = {
    buttonsStyling: false,
    reverseButtons: true,
    showCancelButton: true,
    cancelButtonText: 'Annuler',
    confirmButtonText: 'Confirmer',
  };

  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: DUREE_INFO,
    timerProgressBar: true,
    showCloseButton: true,
    customClass: { popup: 'swal-toast-inresto' },
    // Le compte à rebours reprend au départ du curseur : une notification lue à
    // moitié ne doit pas disparaître sous la souris de qui la lit.
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  /**
   * Demande une confirmation. Résout à `true` si l'utilisateur valide.
   *
   * `recap` affiche un rappel des informations d'identification de l'objet visé,
   * pour les actions où se tromper de ligne a des conséquences. Les valeurs y
   * sont échappées ici, et non par les appelants : elles viennent de saisies
   * utilisateur (nom de client, libellé de produit) qui ne doivent jamais
   * atteindre `html` telles quelles. Les lignes vides sont omises, ce qui permet
   * de passer un rappel complet sans tester chaque champ facultatif d'abord.
   */
  async confirmer(options: OptionsConfirmation): Promise<boolean> {
    if (!this.estNavigateur) {
      return false;
    }

    const danger = options.danger ?? false;

    const resultat = await Swal.fire({
      ...this.baseDialogue,
      title: options.titre,
      icon: options.icone ?? (danger ? 'warning' : 'question'),
      confirmButtonText: options.confirmer ?? this.baseDialogue.confirmButtonText,
      cancelButtonText: options.annuler ?? this.baseDialogue.cancelButtonText,
      focusCancel: danger,
      customClass: {
        confirmButton: danger ? 'btn-danger' : 'btn-primary',
        cancelButton: 'btn-secondary',
      },
      ...this.corpsConfirmation(options),
    });

    return resultat.isConfirmed;
  }

  /**
   * Confirmation d'une suppression : même dialogue, mais avec les libellés et le
   * ton qui vont avec, pour que les dizaines d'appels du projet n'aient pas à
   * les répéter.
   *
   * `cible` est le nom de l'objet tel qu'il s'affiche à l'écran ; `nature` le
   * nom commun qui le précède, article compris (« le produit », « la carte »).
   * Le préciser lève l'ambiguïté quand plusieurs listes cohabitent à l'écran.
   */
  confirmerSuppression(
    cible: string,
    options: Partial<OptionsConfirmation> & { nature?: string } = {}
  ): Promise<boolean> {
    const { nature, ...reste } = options;

    return this.confirmer({
      titre: `Supprimer ${nature ? `${nature} ` : ''}« ${cible} » ?`,
      texte: 'Cette action est irréversible.',
      confirmer: 'Supprimer',
      danger: true,
      ...reste,
    });
  }

  /**
   * Demande une saisie libre. Résout au texte saisi, ou à `null` si
   * l'utilisateur abandonne — jamais à une chaîne vide quand la saisie est
   * déclarée obligatoire.
   */
  async saisir(options: OptionsSaisie): Promise<string | null> {
    if (!this.estNavigateur) {
      return null;
    }

    const obligatoire = options.obligatoire ?? false;

    const resultat = await Swal.fire<string>({
      ...this.baseDialogue,
      title: options.titre,
      text: options.texte,
      input: options.multiligne ? 'textarea' : 'text',
      inputLabel: options.label,
      inputValue: options.valeur ?? '',
      inputPlaceholder: options.placeholder,
      inputAttributes: { autocapitalize: 'off', autocomplete: 'off' },
      confirmButtonText: options.confirmer ?? 'Valider',
      cancelButtonText: options.annuler ?? this.baseDialogue.cancelButtonText,
      customClass: {
        confirmButton: options.danger ? 'btn-danger' : 'btn-primary',
        cancelButton: 'btn-secondary',
        input: options.multiligne ? 'field-textarea' : 'field-input',
      },
      inputValidator: obligatoire
        ? (valeur: string) =>
            valeur.trim()
              ? null
              : typeof obligatoire === 'string'
                ? obligatoire
                : 'Ce champ est requis.'
        : undefined,
    });

    return resultat.isConfirmed ? (resultat.value ?? '') : null;
  }

  /** Message bloquant, pour ce qui doit être lu avant de poursuivre. */
  async message(icone: SweetAlertIcon, titre: string, texte?: string): Promise<void> {
    if (!this.estNavigateur) {
      return;
    }

    await Swal.fire({
      icon: icone,
      title: titre,
      text: texte,
      buttonsStyling: false,
      confirmButtonText: 'OK',
      customClass: { confirmButton: 'btn-primary' },
    });
  }

  succes(message: string, titre?: string): void {
    this.notifier('success', message, titre, DUREE_SUCCES);
  }

  erreur(message: string, titre?: string): void {
    this.notifier('error', message, titre, DUREE_ERREUR);
  }

  avertissement(message: string, titre?: string): void {
    this.notifier('warning', message, titre, DUREE_INFO);
  }

  info(message: string, titre?: string): void {
    this.notifier('info', message, titre, DUREE_INFO);
  }

  /**
   * Un bandeau sans titre porte son message dans le `title` de la bibliothèque,
   * et non dans son `text` : c'est la seule ligne mise en avant, et laisser le
   * titre vide déséquilibrerait la vignette.
   */
  private notifier(
    icone: SweetAlertIcon,
    message: string,
    titre: string | undefined,
    duree: number
  ): void {
    if (!this.estNavigateur) {
      return;
    }

    void this.toast.fire({
      icon: icone,
      title: titre ?? message,
      text: titre ? message : undefined,
      timer: duree,
    });
  }

  /**
   * Corps du dialogue de confirmation : `text` seul quand il n'y a rien à
   * rappeler, `html` dès qu'un récapitulatif l'accompagne — `text` est rendu en
   * `textContent`, où la mise en forme serait perdue.
   */
  private corpsConfirmation(
    options: OptionsConfirmation
  ): Pick<SweetAlertOptions, 'text' | 'html'> {
    const lignes = (options.recap ?? []).filter(
      (ligne) =>
        ligne.valeur !== null &&
        ligne.valeur !== undefined &&
        String(ligne.valeur).trim() !== ''
    );

    if (lignes.length === 0) {
      return { text: options.texte };
    }

    const recap = lignes
      .map(
        (ligne) =>
          `<div class="swal-recap__ligne">
             <span class="swal-recap__label">${echapper(ligne.label)}</span>
             <span class="swal-recap__valeur">${echapper(ligne.valeur!)}</span>
           </div>`
      )
      .join('');

    const texte = options.texte ? `<p class="swal-texte">${echapper(options.texte)}</p>` : '';

    return { html: `${texte}<div class="swal-recap">${recap}</div>` };
  }
}

/** Neutralise le HTML d'une valeur avant de l'injecter dans un dialogue. */
function echapper(valeur: string | number): string {
  return String(valeur).replace(
    /[&<>"']/g,
    (caractere) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[caractere]!
  );
}
