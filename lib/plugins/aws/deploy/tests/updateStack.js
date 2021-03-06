'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const BbPromise = require('bluebird');
const AwsProvider = require('../../provider/awsProvider');
const AwsDeploy = require('../index');
const Serverless = require('../../../../Serverless');
const testUtils = require('../../../../../tests/utils');

describe('updateStack', () => {
  let serverless;
  let awsDeploy;
  const tmpDirPath = testUtils.getTmpDirPath();

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    awsDeploy = new AwsDeploy(serverless, options);

    awsDeploy.deployedFunctions = [{ name: 'first', zipFileKey: 'zipFileOfFirstFunction' }];
    awsDeploy.bucketName = 'deployment-bucket';
    serverless.service.service = `service-${(new Date()).getTime().toString()}`;
    serverless.config.servicePath = tmpDirPath;
    awsDeploy.serverless.service.package.artifactDirectoryName = 'somedir';
    awsDeploy.serverless.cli = new serverless.classes.CLI();
  });

  describe('#createFallback()', () => {
    it('should create a stack with the CF template URL', () => {
      const createStackStub = sinon
        .stub(awsDeploy.provider, 'request').returns(BbPromise.resolve());
      sinon.stub(awsDeploy, 'monitorStack').returns(BbPromise.resolve());

      return awsDeploy.createFallback().then(() => {
        expect(createStackStub.args[0][0]).to.equal('CloudFormation');
        expect(createStackStub.args[0][1]).to.equal('createStack');
        expect(createStackStub.args[0][2].StackName)
          .to.equal(`${awsDeploy.serverless.service.service}-${awsDeploy.options.stage}`);
        expect(createStackStub.args[0][2].OnFailure).to.equal('ROLLBACK');
        expect(createStackStub.args[0][2].TemplateURL)
          .to.be.equal(`https://s3.amazonaws.com/${awsDeploy.bucketName}/${awsDeploy.serverless
          .service.package.artifactDirectoryName}/compiled-cloudformation-template.json`);
        expect(createStackStub.args[0][2].Tags)
          .to.deep.equal([{ Key: 'STAGE', Value: awsDeploy.options.stage }]);
        expect(createStackStub.calledOnce).to.be.equal(true);
        expect(createStackStub.calledWith(awsDeploy.options.stage, awsDeploy.options.region));
        awsDeploy.provider.request.restore();
        awsDeploy.monitorStack.restore();
      });
    });

    it('should include custom stack tags', () => {
      awsDeploy.serverless.service.provider.stackTags = { STAGE: 'overridden', tag1: 'value1' };

      const createStackStub = sinon
        .stub(awsDeploy.provider, 'request').returns(BbPromise.resolve());
      sinon.stub(awsDeploy, 'monitorStack').returns(BbPromise.resolve());

      return awsDeploy.createFallback().then(() => {
        expect(createStackStub.args[0][2].Tags)
          .to.deep.equal([
            { Key: 'STAGE', Value: 'overridden' },
            { Key: 'tag1', Value: 'value1' },
          ]);
        awsDeploy.provider.request.restore();
        awsDeploy.monitorStack.restore();
      });
    });
  });

  describe('#update()', () => {
    let updateStackStub;

    beforeEach(() => {
      updateStackStub = sinon
        .stub(awsDeploy.provider, 'request').returns(BbPromise.resolve());
      sinon.stub(awsDeploy, 'monitorStack').returns(BbPromise.resolve());
    });

    it('should update the stack', () => awsDeploy.update()
      .then(() => {
        expect(updateStackStub.calledOnce).to.be.equal(true);
        expect(updateStackStub.args[0][0]).to.be.equal('CloudFormation');
        expect(updateStackStub.args[0][1]).to.be.equal('updateStack');
        expect(updateStackStub.args[0][2].StackName)
          .to.be.equal(`${awsDeploy.serverless.service.service}-${awsDeploy.options.stage}`);
        expect(updateStackStub.args[0][2].TemplateURL)
          .to.be.equal(`https://s3.amazonaws.com/${awsDeploy.bucketName}/${awsDeploy.serverless
          .service.package.artifactDirectoryName}/compiled-cloudformation-template.json`);
        expect(updateStackStub.args[0][2].Tags)
          .to.deep.equal([{ Key: 'STAGE', Value: awsDeploy.options.stage }]);
        expect(updateStackStub.calledWith(awsDeploy.options.stage, awsDeploy.options.region));


        awsDeploy.provider.request.restore();
        awsDeploy.monitorStack.restore();
      })
    );

    it('should include custom stack tags and policy', () => {
      awsDeploy.serverless.service.provider.stackTags = { STAGE: 'overridden', tag1: 'value1' };
      awsDeploy.serverless.service.provider.stackPolicy = [{
        Effect: 'Allow',
        Principal: '*',
        Action: 'Update:*',
        Resource: '*',
      }];

      return awsDeploy.update().then(() => {
        expect(updateStackStub.args[0][2].Tags)
          .to.deep.equal([
            { Key: 'STAGE', Value: 'overridden' },
            { Key: 'tag1', Value: 'value1' },
          ]);
        expect(updateStackStub.args[0][2].StackPolicyBody)
          .to.equal(
            '{"Statement":[{"Effect":"Allow","Principal":"*","Action":"Update:*","Resource":"*"}]}'
          );

        awsDeploy.provider.request.restore();
        awsDeploy.monitorStack.restore();
      });
    });
  });

  describe('#updateStack()', () => {
    it('should resolve if no deploy', () => {
      awsDeploy.options.noDeploy = true;

      const writeUpdateTemplateStub = sinon
        .stub(awsDeploy, 'writeUpdateTemplateToDisk').returns();
      const updateStub = sinon
        .stub(awsDeploy, 'update').returns(BbPromise.resolve());

      return awsDeploy.updateStack().then(() => {
        expect(writeUpdateTemplateStub.calledOnce).to.be.equal(true);
        expect(updateStub.called).to.be.equal(false);

        awsDeploy.writeUpdateTemplateToDisk.restore();
        awsDeploy.update.restore();
      });
    });

    it('should fallback to createStack if createLater flag exists', () => {
      awsDeploy.createLater = true;

      const writeUpdateTemplateStub = sinon
        .stub(awsDeploy, 'writeUpdateTemplateToDisk').returns();
      const createFallbackStub = sinon
        .stub(awsDeploy, 'createFallback').returns(BbPromise.resolve());
      const updateStub = sinon
        .stub(awsDeploy, 'update').returns(BbPromise.resolve());

      return awsDeploy.updateStack().then(() => {
        expect(writeUpdateTemplateStub.calledOnce).to.be.equal(true);
        expect(createFallbackStub.calledOnce).to.be.equal(true);
        expect(updateStub.called).to.be.equal(false);

        awsDeploy.writeUpdateTemplateToDisk.restore();
        awsDeploy.update.restore();
      });
    });

    it('should write the template to disk even if the noDeploy option was not used', () => {
      awsDeploy.options.noDeploy = false;

      const writeUpdateTemplateStub = sinon
        .stub(awsDeploy, 'writeUpdateTemplateToDisk').returns();
      const updateStub = sinon
        .stub(awsDeploy, 'update').returns(BbPromise.resolve());

      return awsDeploy.updateStack().then(() => {
        expect(writeUpdateTemplateStub.calledOnce).to.be.equal(true);
        expect(updateStub.called).to.be.equal(true);

        awsDeploy.writeUpdateTemplateToDisk.restore();
        awsDeploy.update.restore();
      });
    });

    it('should run promise chain in order', () => {
      const updateStub = sinon
        .stub(awsDeploy, 'update').returns(BbPromise.resolve());

      return awsDeploy.updateStack().then(() => {
        expect(updateStub.calledOnce).to.be.equal(true);

        awsDeploy.update.restore();
      });
    });
  });

  describe('#writeUpdateTemplateToDisk', () => {
    it('should write the compiled CloudFormation template into the .serverless directory', () => {
      awsDeploy.serverless.service.provider.compiledCloudFormationTemplate = { key: 'value' };

      const templatePath = path.join(tmpDirPath,
        '.serverless',
        'cloudformation-template-update-stack.json');

      return awsDeploy.writeUpdateTemplateToDisk().then(() => {
        expect(serverless.utils.fileExistsSync(templatePath)).to.equal(true);
        expect(serverless.utils.readFileSync(templatePath)).to.deep.equal({ key: 'value' });
      });
    });
  });
});
