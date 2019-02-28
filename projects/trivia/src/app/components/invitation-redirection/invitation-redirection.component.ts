import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';

import { Store, select } from '@ngrx/store';
import { User } from 'shared-library/shared/model';
import { AuthenticationProvider } from 'shared-library/core/auth';
import { AppState, appState } from '../../store';
import {UserActions} from 'shared-library/core/store/actions';
import { Utils } from 'shared-library/core/services';
import { Subscription } from 'rxjs';

@Component({
    selector: 'invitation-redirection',
    templateUrl: './invitation-redirection.component.html',
    styleUrls: ['./invitation-redirection.component.scss', './invitation-redirection.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvitationRedirectionComponent implements OnInit, OnDestroy {

    @Input() user: User;
    subs: Subscription[] = [];

    constructor(private activatedRoute: ActivatedRoute, private router: Router, private store: Store<AppState>,
        private userAction: UserActions, private utils: Utils ) {
            this.subs.push(this.store.select(appState.coreState).pipe(select(s => s.user)).subscribe(user => {
            this.user = user;
            if (user) {
                this.user = user;
            }
        }));
    }

    ngOnInit() {
        // subscribe to router event
       this.activatedRoute.params.subscribe((params: Params) => {
            const token = params['token'];
            this.store.dispatch(this.userAction.storeInvitationToken(token));
            if (this.user) {
                this.store.dispatch(this.userAction.makeFriend({ token: token, email: this.user.email, userId: this.user.authState.uid }))
            } else {
                this.router.navigate(['/dashboard']);
            }

        });
    }

    ngOnDestroy(): void {
        this.utils.unsubscribe(this.subs);
    }

}
