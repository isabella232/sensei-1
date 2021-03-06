import toClick from 'expect-puppeteer/lib/matchers/toClick';
import {
	adminUrl,
	cleanupSenseiData,
	resetSetupWizard,
} from '../../utils/helpers';
import { AdminFlow } from '../../utils/flows';

/**
 * According to this github issue https://github.com/smooth-code/jest-puppeteer/issues/324, the default timeout isn't
 * respected and actions timeout after 500ms which cause a lot of test failures. The below lines are a workaround.
 */
const setDefaultOptions = require( 'expect-puppeteer' ).setDefaultOptions;
setDefaultOptions( { timeout: 30000 } );

async function openSetupWizard() {
	return AdminFlow.goTo( 'admin.php?page=sensei_setup_wizard' );
}

async function stepIsComplete( label ) {
	return expect( page ).toMatchElement(
		'.woocommerce-stepper__step.is-complete',
		{
			text: label,
		}
	);
}

async function stepIsActive( label ) {
	return expect( page ).toMatchElement(
		'.woocommerce-stepper__step.is-active',
		{
			text: label,
		}
	);
}

/**
 * Setup Wizard E2E tests.
 *
 * These tests should be run sequentially.
 */
describe( 'Setup Wizard', () => {
	beforeAll( async () => {
		await AdminFlow.login();
	} );

	it( 'opens when first activating the Sensei LMS plugin', async () => {
		await AdminFlow.activatePlugin( 'sensei-lms' );
		await cleanupSenseiData();

		await AdminFlow.activatePlugin( 'sensei-lms', true );
		await page.waitForNavigation();
		await expect( page.url() ).toMatch(
			'admin.php?page=sensei_setup_wizard'
		);
	} );

	it( 'shows a notice to run the Setup Wizard', async () => {
		await AdminFlow.goToPlugins();

		await expect( page ).toClick( '.sensei-message a', {
			text: 'Setup Wizard',
		} );
		await page.waitForNavigation();
		await expect( page ).toMatch( 'Welcome to Sensei LMS!' );
	} );

	describe( 'Welcome step', () => {
		beforeAll( async () => await resetSetupWizard() );

		it( 'opens on first launch', async () => {
			await openSetupWizard();
			await expect( page ).toMatch( 'Welcome to Sensei LMS!' );
		} );

		it( 'displays usage tracking modal when clicking continue', async () => {
			await expect( page ).toClick( 'button', { text: 'Continue' } );
			await expect( page ).toMatch( 'Build a Better Sensei LMS' );
		} );

		it( 'marks welcome step done and goes to purpose step', async () => {
			await expect( page ).toClick(
				'.sensei-setup-wizard__usage-modal button',
				{
					text: 'Continue',
				}
			);

			await stepIsComplete( 'Welcome' );
			await stepIsActive( 'Purpose' );
			await expect( page ).toMatch(
				'What is your primary purpose for offering online courses?'
			);
		} );
	} );

	describe( 'Purpose step', () => {
		it( 'opens when it is the active step', async () => {
			await openSetupWizard();
			await stepIsComplete( 'Welcome' );
			await stepIsActive( 'Purpose' );
			await expect( page ).toMatch(
				'What is your primary purpose for offering online courses?'
			);
		} );

		it( 'disables Continue until something is selected', async () => {
			await expect( page ).toMatchElement( 'button[disabled]', {
				text: 'Continue',
			} );
		} );

		it( 'allows selecting purposes', async () => {
			await expect( page ).toClick( 'label', {
				text: 'Promote your business',
			} );
			await expect( page ).toClick( 'label', { text: 'Other' } );
			await expect( page ).toFill(
				'.sensei-setup-wizard__textcontrol-other input',
				'Other'
			);

			await expect( page ).toClick( 'button', { text: 'Continue' } );
		} );

		it( 'marks purpose step done and goes to features step', async () => {
			await stepIsComplete( 'Purpose' );
			await stepIsActive( 'Features' );
			await expect( page ).toMatch(
				'Enhance your online courses with these optional features.'
			);
		} );
	} );

	describe( 'Features step', () => {
		beforeAll( async () => {
			await AdminFlow.deactivatePlugin( 'sensei-certificates' );
			await openSetupWizard();
		} );

		it( 'opens when it is the active step', async () => {
			await stepIsComplete( 'Purpose' );
			await stepIsActive( 'Features' );
			await expect( page ).toMatch(
				'Enhance your online courses with these optional features.'
			);
		} );

		it( 'allows selecting plugins', async () => {
			await expect( page ).toClick( 'label', {
				text: 'Sensei LMS Certificates',
			} );

			await expect( page ).toMatchElement(
				'.components-checkbox-control__checked'
			);
		} );

		it( 'confirms plugin installation', async () => {
			await expect( page ).toClick( 'button', { text: 'Continue' } );
			await expect( page ).toMatch(
				'Would you like to install the following features now?'
			);

			await expect( page ).toMatchElement(
				'.sensei-setup-wizard__features-confirmation-modal .woocommerce-list__item-title',
				{
					text: 'Sensei LMS Certificates',
				}
			);
		} );

		it( 'installs selected plugins', async () => {
			await expect( page ).toClick( 'button', { text: 'Install now' } );

			await expect( page ).toMatchElement(
				'.woocommerce-list__item-title',
				{
					text: 'Sensei LMS Certificates — Installed',
				}
			);
			await expect( page ).toClick( 'button', { text: 'Continue' } );

			await AdminFlow.goToPlugins();
			expect(
				await AdminFlow.isPluginActive( 'sensei-certificates' )
			).toBeTruthy();
		} );

		it( 'marks installed plugins as unavailable', async () => {
			await openSetupWizard();

			expect( page ).toClick( '.woocommerce-stepper__step', {
				text: 'Features',
			} );

			await expect( page ).toMatchElement( '.status-installed', {
				text: 'Sensei LMS Certificates — Installed',
			} );
		} );
	} );

	describe( 'Ready step', () => {
		beforeEach( async () => {
			await openSetupWizard();
			await toClick( page, '.woocommerce-stepper__step', {
				text: 'Ready',
			} );
		} );

		it( 'is available if it is the active step', async () => {
			await stepIsComplete( 'Features' );
			await stepIsActive( 'Ready' );
			await expect( page ).toMatch(
				"You're ready to start creating online courses!"
			);
		} );

		it( 'has newsletter sign-up form', async () => {
			const form = await expect( page ).toMatchElement(
				'form[action="https://senseilms.us19.list-manage.com/subscribe/post?u=7a061a9141b0911d6d9bafe3a&id=4fa225a515"]'
			);

			await expect( form ).toMatchElement(
				'input[name="EMAIL"][value="admin@woocommercecoree2etestsuite.com"]'
			);
			await expect( form ).toMatchElement( 'button', {
				text: 'Yes, please!',
			} );
		} );

		it( 'links to course creation', async () => {
			await expect( page ).toMatchElement(
				'a[href="post-new.php?post_type=course"]',
				{
					text: 'Create a course',
				}
			);
		} );

		it( 'links to importer', async () => {
			await expect( page ).toClick( 'a', {
				text: 'Import content',
			} );
			await page.waitForNavigation();
			await expect( page.url() ).toMatch(
				adminUrl( 'admin.php?page=sensei_import' )
			);
		} );
	} );
} );
