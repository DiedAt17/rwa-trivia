import { TestBed, ComponentFixture, async } from '@angular/core/testing';
import { NewsletterComponent } from './newsletter.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { StoreModule, Store, MemoizedSelector } from '@ngrx/store';
import { User, Subscription } from 'shared-library/shared/model';
import { AppState, appState } from '../../../store';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { CoreState } from 'shared-library/core/store';
import { DashboardState } from '../../store';
import * as dashboardActions from '../../store/actions';

describe('Testing Newsletter Component', () => {

  let component: NewsletterComponent;
  let fixture: ComponentFixture<NewsletterComponent>;
  let user: User;
  let mockStore: MockStore<AppState>;
  let spy: any;
  let mockCoreSelector: MemoizedSelector<AppState, Partial<CoreState>>;
  let mockDashboardSelector: MemoizedSelector<AppState, Partial<DashboardState>>;

  beforeEach(async(() => {

    TestBed.configureTestingModule({

      imports: [ReactiveFormsModule, FormsModule, StoreModule.forRoot({})],
      providers: [provideMockStore({
        initialState: {},
        selectors: [
          {
            selector: appState.coreState,
            value: {}
          },
          {
            selector: appState.dashboardState,
            value: {}
          }
        ]
      })],
      declarations: [NewsletterComponent],
    });

    user = {
      userId: '1',
      displayName: 'test',
      authState: null,
      bulkUploadPermissionStatus: '',
      bulkUploadPermissionStatusUpdateTime: 0,
      croppedImageUrl: '',
      originalImageUrl: '',
      imageType: '',
      achievements: null,
      gamePlayed: null,
      email: 'test@test.com'
    };

    // create component and NewsletterComponent fixture
    fixture = TestBed.createComponent(NewsletterComponent);

    // get NewsletterComponent component from the fixture
    component = fixture.componentInstance;
    fixture = TestBed.createComponent(NewsletterComponent);
    mockStore = TestBed.get(Store);
    mockCoreSelector = mockStore.overrideSelector<AppState, Partial<CoreState>>(appState.coreState, {});
    mockDashboardSelector = mockStore.overrideSelector<AppState, Partial<DashboardState>>(appState.dashboardState, {});
    component = fixture.componentInstance;
    spy = spyOn(mockStore, 'dispatch');
    fixture.detectChanges();
  }));

  afterEach(() => { fixture.destroy(); });

  it('Form should have Email set for logged in user', () => {
    mockCoreSelector.setResult({ user });
    mockStore.refreshState();
    expect(component.subscriptionForm.get('email').value).toEqual('test@test.com');

  });

  it('Form should be valid for logged in user', () => {
    mockCoreSelector.setResult({ user });
    mockStore.refreshState();
    expect(component.subscriptionForm.valid).toBeTruthy();
  });

  it('Form should not have email set when user is not logged in ', () => {
    expect(component.subscriptionForm.get('email').value).toEqual('');
  });

  it('Form should be default invalid when user is not logged in', () => {
    expect(component.subscriptionForm.valid).toBeFalsy();
  });

  it('Form should have email required error when email is not set ', () => {
    expect(component.subscriptionForm.get('email').errors).toEqual({ 'required': true });
  });

  it('Form should have email pattern error when email enter does not match pattern ', () => {
    component.subscriptionForm.get('email').setValue('test');
    expect(component.subscriptionForm.get('email').errors).toEqual({
      'pattern': {
        // tslint:disable-next-line: max-line-length
        'actualValue': 'test', 'requiredPattern': '/^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$/'
      }
    });
  });

  it('Form should be valid when valid email is provided', () => {
    component.subscriptionForm.get('email').setValue('test@test.com');
    expect(component.subscriptionForm.valid).toBeTruthy();
  });

  it('on load component should dispatch action to get subscription count', () => {
    spy.and.callFake((action: dashboardActions.GetTotalSubscriber) => {
      expect(action.type).toEqual(dashboardActions.DashboardActionTypes.TOTAL_SUBSCRIBER);
    });
    component.ngOnInit();
    expect(mockStore.dispatch).toHaveBeenCalled();
  });

  it('on load component should have empty message', () => {
      expect(component.message).toEqual('');
  });

  it('on subscription status true correct message should be set', () => {
    mockDashboardSelector.setResult({ checkEmailSubscriptionStatus: true });
    mockStore.refreshState();
    expect(component.message).toBe('This EmailId is already Subscribed!!');
  });

  it('on subscription status false correct message should be set', () => {
    mockDashboardSelector.setResult({ checkEmailSubscriptionStatus: false });
    mockStore.refreshState();
    expect(component.message).toBe('Your EmailId is Successfully Subscribed!!');
  });

  it('on subscribe should dispatch action to add subscriber with correct payload when user is not logged in', () => {
    component.subscriptionForm.controls['email'].setValue('test@test.com');
    const subscription = new Subscription();
    subscription.email = 'test@test.com';
    spy.and.callFake((action: dashboardActions.AddSubscriber) => {
      expect(action.type).toEqual(dashboardActions.DashboardActionTypes.ADD_SUBSCRIBER);
      expect(action.payload.subscription).toEqual(subscription);
    });
    // Trigger the subscribe function
    component.onSubscribe();
    expect(mockStore.dispatch).toHaveBeenCalled();
  });

  it('on subscribe should dispatch action to add subscriber with correct payload when user is logged in', () => {
    const subscription = new Subscription();
    subscription.email = 'test@test.com';
    subscription.userId = '1';
    spy.and.callFake((action: dashboardActions.AddSubscriber) => {
      expect(action.type).toEqual(dashboardActions.DashboardActionTypes.ADD_SUBSCRIBER);
      expect(action.payload.subscription).toEqual(subscription);
    });
    mockCoreSelector.setResult({ user });
    mockStore.refreshState();
    // Trigger the subscribe function
    component.onSubscribe();
    expect(mockStore.dispatch).toHaveBeenCalled();
  });

});
